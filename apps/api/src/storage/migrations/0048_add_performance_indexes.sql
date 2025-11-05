-- Add indexes for improved query performance
-- These indexes optimize the most common queries identified in the performance audit

-- Index for course filtering by student (used in getAllCourses, getCoursesForUser)
CREATE INDEX IF NOT EXISTS idx_student_courses_lookup
ON student_courses(course_id, student_id);

-- Index for statistics queries (used in getCourseStatistics, getStudentsProgress)
CREATE INDEX IF NOT EXISTS idx_lesson_progress_stats
ON student_lesson_progress(user_id, lesson_id);

-- Index for lesson ordering (used in getLessonById, chapter queries)
CREATE INDEX IF NOT EXISTS idx_lessons_ordering
ON lessons(chapter_id, display_order);

-- Index for user role filtering (used frequently in authorization)
CREATE INDEX IF NOT EXISTS idx_users_role
ON users(role);

-- Index for announcement filtering by read status
CREATE INDEX IF NOT EXISTS idx_user_announcements_read
ON user_announcements(user_id, is_read);

-- Index for quiz attempts by user and lesson
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_lesson
ON quiz_attempts(user_id, lesson_id);

-- Composite index for group users lookup
CREATE INDEX IF NOT EXISTS idx_group_users_lookup
ON group_users(group_id, user_id);
