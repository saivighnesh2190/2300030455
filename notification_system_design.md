# Campus Notifications Microservice — System Design

Roll Number: 2300030455
Name: Nekkanti Sai Vighnesh


## Stage 1 — REST API Design

The notification system allows students to receive updates about Placements, Results, and Events. Each notification has an ID, Type, Message, Timestamp, studentID, and isRead status.

I designed 4 main endpoints:

1) GET /api/notifications
   Fetches notifications for a student. Supports query params like page, limit, notification_type (Placement/Result/Event), and isRead (true/false) for filtering. Returns a paginated list of notifications.

2) POST /api/notifications
   Admin uses this to create and send a notification. The request body contains Type, Message, and a list of studentIDs who should receive it. Returns a success message with the notification ID.

3) PUT /api/notifications/:id/read
   Marks a specific notification as read for the student. Takes the notification ID in the URL. Returns a confirmation message.

4) GET /api/notifications/priority-inbox?n=10
   Returns the top n most important unread notifications. Sorted by priority where Placement comes first, then Result, then Event. Within the same type, newer notifications come first.

All protected endpoints require an Authorization Bearer token in the headers.

Real-Time Mechanism — I chose Server-Sent Events (SSE) over WebSockets and Polling. The endpoint is GET /api/notifications/stream. SSE works best here because notifications are one-way, the server pushes to the client and students dont send anything back. WebSockets are overkill since they support two-way communication which we dont need. Polling wastes resources because 50K students hitting the server every few seconds would generate mostly empty responses. SSE keeps one connection open per student and the browser handles reconnection automatically.


## Stage 2 — Database Design

I chose PostgreSQL (SQL) for this system. Notifications have a fixed structure where every notification has the same fields like ID, Type, Message, Timestamp, studentID, and isRead. This fits naturally into rows and columns. We also need filtering by type and read status, ordering by timestamp, and joins between students and notifications. SQL handles all of this out of the box. NoSQL like MongoDB would make sense if each notification had a different shape, but ours are all uniform so SQL is the better fit.

Schema — I have two tables:

students table:
  id         — INTEGER, primary key, auto increment
  name       — VARCHAR(100)
  email      — VARCHAR(150), unique

notifications table:
  id         — UUID, primary key, default generated
  type       — VARCHAR(20), one of Placement/Result/Event
  message    — TEXT
  timestamp  — TIMESTAMP, defaults to current time
  studentID  — INTEGER, foreign key referencing students(id)
  isRead     — BOOLEAN, default false

The studentID in notifications links to the students table. So each notification belongs to one student. If an admin sends a notification to 100 students, 100 rows get created in the notifications table, one per student.

Scaling Problems at 50K students and 5M notifications:

The biggest problem is query speed. When a student fetches their unread notifications, the database has to scan through millions of rows to find the ones matching their studentID. Without proper indexes this becomes very slow. The notifications table will keep growing and simple queries like counting unread notifications will take seconds instead of milliseconds. Sorting by timestamp across millions of rows is expensive. Also if many students hit the API at the same time during peak hours like result announcements, the database connections get exhausted.

SQL queries that power the Stage 1 endpoints:

1) GET /api/notifications — Fetch filtered notifications for a student:
   SELECT id, type, message, timestamp, isRead FROM notifications
   WHERE studentID = 1042 AND type = 'Placement' AND isRead = false
   ORDER BY timestamp DESC
   LIMIT 10 OFFSET 0;

2) POST /api/notifications — Insert a new notification:
   INSERT INTO notifications (id, type, message, studentID)
   VALUES (gen_random_uuid(), 'Placement', 'Google hiring for SDE-1', 1042);

3) PUT /api/notifications/:id/read — Mark as read:
   UPDATE notifications SET isRead = true
   WHERE id = '44911ace-bd6e-41b6-90c1-209f71ddbf39' AND studentID = 1042;

4) GET /api/notifications/priority-inbox — Priority inbox query:
   SELECT id, type, message, timestamp FROM notifications
   WHERE studentID = 1042 AND isRead = false
   ORDER BY
     CASE type WHEN 'Placement' THEN 1 WHEN 'Result' THEN 2 WHEN 'Event' THEN 3 END,
     timestamp DESC
   LIMIT 10;

The priority inbox query uses a CASE statement to assign a number to each type so Placement sorts first, then Result, then Event. Within the same type it sorts by newest first.


## Stage 3 — Query Optimization

The given slow query:
SELECT * FROM notifications WHERE studentID = 1042 AND isRead = false ORDER BY createdAt DESC;

Is the query correct? Yes, it does what its supposed to do. It fetches all unread notifications for student 1042 sorted by newest first. But it is slow because the database has no index on studentID or isRead. So it does a full table scan, meaning it checks every single row in the notifications table to find matches. With 5 million rows this takes a long time. Also SELECT * fetches all columns including ones we might not need, which wastes memory.

How to fix it — add a composite index on the columns we filter and sort by:
CREATE INDEX idx_student_read_time ON notifications(studentID, isRead, createdAt DESC);

This index lets the database jump directly to the rows for student 1042 where isRead is false, already sorted by createdAt. Instead of scanning 5 million rows it scans maybe 20. Also replace SELECT * with only the columns we actually need:
SELECT id, type, message, createdAt FROM notifications WHERE studentID = 1042 AND isRead = false ORDER BY createdAt DESC;

Is indexing every column a good idea? No. Indexes speed up reads but slow down writes. Every time a new notification is inserted or a notification is marked as read, all indexes on that table have to be updated. If you index every column, every write operation becomes expensive. The right approach is to only index columns that are frequently used in WHERE, ORDER BY, or JOIN clauses. For our case studentID, isRead, createdAt, and type are the ones worth indexing.

Query to find all students who received a Placement notification in the last 7 days:
SELECT DISTINCT s.id, s.name, s.email FROM students s
JOIN notifications n ON s.id = n.studentID
WHERE n.type = 'Placement' AND n.timestamp >= NOW() - INTERVAL '7 days';

This joins the students and notifications tables, filters for Placement type within the last 7 days, and uses DISTINCT so each student appears only once even if they got multiple placement notifications.


## Stage 4 — Performance and Caching

Problem: notifications are fetched from the database on every page load. With 50K students refreshing their pages, the DB gets overwhelmed with repeated identical queries.

Solution 1 — Redis Cache

Store the recent notifications of each student in Redis (an in-memory key-value store). When a student opens the app, check Redis first. If the data is there, return it directly without touching the database. If its not there (cache miss), query the DB, return the result, and also store it in Redis with a TTL of say 2 minutes.


Solution 2 — Pagination

Instead of loading all notifications at once, load them in small pages of 10 or 20. The query uses LIMIT and OFFSET so the database only processes a small chunk of data per request.


Solution 3 — Database Connection Pooling

Use a connection pool (like PgBouncer for PostgreSQL) to limit and reuse database connections. Without pooling, 50K simultaneous users could try to open 50K connections and crash the database. A pool keeps say 100 connections open and queues the rest.


Best approach is to combine all three. Use Redis for caching hot data, pagination to keep queries small, and connection pooling to protect the database. Each one solves a different part of the problem.


## Stage 5 — Fault Tolerance

The broken pseudocode given:

  for each student in all_50000_students:
      send_email(student, notification)
      insert_into_db(student, notification)
      send_in_app_push(student, notification)

send_email failed at student #24800. The loop crashes and the remaining 25200 students get nothing.

What went wrong? Three main issues. First, there is no try-catch or error handling. One failure kills the entire loop. Second, all 50000 students are processed in a single loop with no batching. If anything goes wrong midway there is no way to resume from where it stopped. Third, email sending is an external network call that can fail for many reasons like SMTP timeout, rate limiting, or server downtime. Treating it the same as a local DB insert is a mistake.

Should email and DB insert happen together? No, they should be separate. The DB insert is a local operation that is fast and reliable. Email sending is an external call that depends on a third party SMTP server which can fail, be slow, or rate limit you. If you put them in the same transaction and the email fails, the DB insert also rolls back and the student loses the notification entirely. Better to save the notification to DB first (so the student can see it in-app) and then send the email separately. If the email fails, the notification is still saved and you can retry the email later.

Redesigned pseudocode:

  failed_queue = []

  batches = split_into_batches(all_50000_students, batch_size=500)

  for each batch in batches:
      for each student in batch:
          try:
              insert_into_db(student, notification)
              send_in_app_push(student, notification)
          catch error:
              log_error(student, error)
              failed_queue.push({ student, step: "db_or_push" })
              continue

          try:
              send_email(student, notification)
          catch error:
              log_error(student, error)
              failed_queue.push({ student, step: "email" })
              continue

  // retry failed ones
  for each item in failed_queue:
      retry with exponential backoff (max 3 attempts)
      if still failing, move to dead_letter_queue for manual review

What changed in the redesign. First, try-catch around each student so one failure doesnt kill the rest. Second, DB insert and email are separated so a failed email doesnt lose the notification. Third, processing in batches of 500 so we can track progress and resume if needed. Fourth, failed students go into a retry queue with exponential backoff instead of being silently skipped. Fifth, after max retries, permanently failed ones go to a dead letter queue where someone can manually check what went wrong.

