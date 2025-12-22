# Backend Implementation Guide: Weekly Review Feature

This document outlines the backend API endpoints and database schema needed to support the Weekly Review feature in Flowmatic.

## Important: Week Boundaries

**The review week runs Wednesday to Tuesday**, not Monday to Sunday.

- Week starts on **Wednesday**
- Week ends on **Tuesday**
- Monday and Tuesday belong to the **previous week** for review purposes
- This means on Mon/Tue, users are still completing their review for the previous Wed-Tue period

Example:

- Wed Jan 3 - Tue Jan 9 = Week 1
- Wed Jan 10 - Tue Jan 16 = Week 2
- If today is Monday Jan 8, the current review period is still Week 1 (Jan 3-9)

## Database Schema

### WeeklyReview Collection/Table

```typescript
interface WeeklyReview {
  _id: ObjectId; // MongoDB ObjectId
  user_id: string; // Reference to user
  week_start: string; // ISO date string (Wednesday of the week, e.g., "2024-01-03")
  week_end: string; // ISO date string (Tuesday, e.g., "2024-01-09")
  checklist: ChecklistItem[]; // Array of checklist items with completion status
  questions: QuestionItem[]; // Array of questions with answers
  inbox_items: string[]; // Quick capture items added throughout the week
  is_completed: boolean; // Whether the review has been marked as complete
  completed_at?: string; // ISO timestamp when marked complete
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

interface ChecklistItem {
  id: string; // Unique identifier for the item
  label: string; // Display text for the checklist item
  checked: boolean; // Completion status
}

interface QuestionItem {
  id: string; // Unique identifier for the question
  question: string; // The question text
  answer: string; // User's answer (can be empty string)
}
```

### Index Recommendations

```javascript
// MongoDB indexes
db.weekly_reviews.createIndex({ user_id: 1, week_start: 1 }, { unique: true });
db.weekly_reviews.createIndex({ user_id: 1, is_completed: 1 });
db.weekly_reviews.createIndex({ user_id: 1, created_at: -1 });
```

## API Endpoints

### 1. Get Weekly Review

**GET** `/api/reviews/week/:weekStart`

Retrieves the review for a specific week.

**Parameters:**

- `weekStart` (path): ISO date string for the Wednesday of the week (e.g., "2024-01-03")

**Response:**

```json
{
  "_id": "...",
  "user_id": "...",
  "week_start": "2024-01-03",
  "week_end": "2024-01-09",
  "checklist": [
    { "id": "beeper", "label": "Read all Beeper messages...", "checked": true },
    ...
  ],
  "questions": [
    { "id": "goals", "question": "What are my goals right now?", "answer": "..." },
    ...
  ],
  "inbox_items": ["Call dentist", "Research new keyboard"],
  "is_completed": false,
  "created_at": "2024-01-04T10:00:00Z",
  "updated_at": "2024-01-06T15:30:00Z"
}
```

**Error Responses:**

- `404`: No review found for this week (frontend handles this gracefully)
- `401`: Unauthorized

---

### 2. Save/Update Weekly Review

**POST** `/api/reviews`

Creates or updates a weekly review. Uses upsert behavior based on `user_id` + `week_start`.

**Request Body:**

```json
{
  "week_start": "2024-01-03",
  "week_end": "2024-01-09",
  "checklist": [
    { "id": "beeper", "label": "Read all Beeper messages...", "checked": true },
    ...
  ],
  "questions": [
    { "id": "goals", "question": "What are my goals right now?", "answer": "Focus on..." },
    ...
  ],
  "inbox_items": ["Call dentist", "Research new keyboard"],
  "is_completed": false
}
```

**Response:**
Returns the saved review document.

**Implementation Notes:**

- Use upsert: if review exists for `user_id` + `week_start`, update it; otherwise create new
- Always update `updated_at` timestamp
- Set `created_at` only on insert
- `inbox_items` is an array of strings for quick capture throughout the week

---

### 3. Complete Weekly Review

**POST** `/api/reviews/week/:weekStart/complete`

Marks a weekly review as complete and updates the streak.

**Parameters:**

- `weekStart` (path): ISO date string for the Wednesday of the week

**Response:**

```json
{
  "_id": "...",
  "user_id": "...",
  "week_start": "2024-01-03",
  "week_end": "2024-01-09",
  "is_completed": true,
  "completed_at": "2024-01-08T18:00:00Z",
  ...
}
```

**Implementation Notes:**

- Set `is_completed = true`
- Set `completed_at` to current timestamp
- This endpoint triggers streak recalculation

---

### 4. Get Review Streak

**GET** `/api/reviews/streak`

Returns the user's current and longest review streak.

**Response:**

```json
{
  "current_streak": 5,
  "longest_streak": 12,
  "last_completed_week": "2024-01-03"
}
```

**Streak Calculation Logic (Wednesday-based weeks):**

```python
def calculate_streak(user_id):
    # Get all completed reviews, sorted by week_start descending
    reviews = db.weekly_reviews.find({
        "user_id": user_id,
        "is_completed": True
    }).sort("week_start", -1)

    if not reviews:
        return { "current_streak": 0, "longest_streak": 0 }

    current_streak = 0
    longest_streak = 0

    # Get today in user's timezone
    today = datetime.now()
    day_of_week = today.weekday()  # 0=Mon, 1=Tue, 2=Wed, etc.

    # Calculate the Wednesday that starts the PREVIOUS review week
    # (the one that should be completed by now)
    # Wed=2, Thu=3, Fri=4, Sat=5, Sun=6, Mon=0, Tue=1
    if day_of_week >= 2:  # Wed-Sun
        # Previous week's Wednesday
        days_to_prev_wed = day_of_week - 2 + 7
    else:  # Mon-Tue
        # Still in review period for week that started 5-6 days ago + 7
        days_to_prev_wed = day_of_week + 5 + 7

    previous_week_wednesday = today - timedelta(days=days_to_prev_wed)
    prev_week_start = previous_week_wednesday.strftime("%Y-%m-%d")

    reviews_list = list(reviews)

    if not reviews_list:
        return { "current_streak": 0, "longest_streak": 0 }

    # Check if most recent completed review is from the expected previous week
    most_recent = reviews_list[0]["week_start"]

    if most_recent != prev_week_start:
        # Check if it's from the week before that (allowing grace period)
        grace_week = (previous_week_wednesday - timedelta(days=7)).strftime("%Y-%m-%d")
        if most_recent != grace_week:
            current_streak = 0
        else:
            # Count from grace week
            expected_week = grace_week
            for review in reviews_list:
                if review["week_start"] == expected_week:
                    current_streak += 1
                    expected_date = datetime.strptime(expected_week, "%Y-%m-%d")
                    prev_week = expected_date - timedelta(days=7)
                    expected_week = prev_week.strftime("%Y-%m-%d")
                else:
                    break
    else:
        # Count consecutive weeks starting from prev_week_start
        expected_week = prev_week_start
        for review in reviews_list:
            if review["week_start"] == expected_week:
                current_streak += 1
                expected_date = datetime.strptime(expected_week, "%Y-%m-%d")
                prev_week = expected_date - timedelta(days=7)
                expected_week = prev_week.strftime("%Y-%m-%d")
            else:
                break

    # Calculate longest streak (iterate through all reviews)
    # ... similar logic but tracking max

    return {
        "current_streak": current_streak,
        "longest_streak": max(current_streak, longest_streak),
        "last_completed_week": reviews_list[0]["week_start"] if reviews_list else None
    }
```

---

### 5. Get All Reviews

**GET** `/api/reviews`

Returns all reviews for the authenticated user (for history/insights).

**Query Parameters (optional):**

- `limit`: Number of reviews to return (default: 52, i.e., 1 year)
- `offset`: Pagination offset

**Response:**

```json
[
  {
    "_id": "...",
    "week_start": "2024-01-03",
    "is_completed": true,
    ...
  },
  ...
]
```

---

## User Preferences Extension

The frontend stores review configuration in user preferences. Ensure the user preferences schema supports these fields:

```typescript
interface UserPreferences {
  // ... existing fields ...

  // Review customization
  reviewChecklistItems?: Array<{
    id: string;
    label: string;
  }>;
  reviewQuestions?: Array<{
    id: string;
    question: string;
  }>;
}
```

These are saved via the existing `PUT /api/auth/:userId/preferences` endpoint.

---

## Frontend Indicator Logic

The frontend shows a red indicator on the Review sidebar item when:

1. It's Saturday, Sunday, Monday, or Tuesday
2. AND the **previous week's** review is not completed

The "previous week" is the Wed-Tue period that ended before the current Wed-Tue period.

Example timeline:

- Wed Jan 3 starts Week 1
- Tue Jan 9 ends Week 1
- Wed Jan 10 starts Week 2
- On Sat Jan 6, Sun Jan 7, Mon Jan 8, Tue Jan 9: If Week 1 review not done → show red
- On Wed Jan 10+: Checking Week 1 completion (can still complete during grace period)

---

## Authentication

All endpoints require authentication via Bearer token in the Authorization header:

```
Authorization: Bearer <token>
```

Extract `user_id` from the JWT token for all queries.

---

## Error Handling

Standard error response format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Common error codes:

- `UNAUTHORIZED`: Invalid or missing authentication
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid request body
- `INTERNAL_ERROR`: Server error

---

## Testing Checklist

- [ ] Create new review for a week (using Wednesday date)
- [ ] Update existing review (auto-save)
- [ ] Add inbox items throughout the week
- [ ] Complete a review
- [ ] Verify streak calculation with consecutive weeks (Wed-Tue)
- [ ] Verify streak resets when week is skipped
- [ ] Verify review preferences are saved and loaded correctly
- [ ] Test week boundary handling (what happens on Tuesday night vs Wednesday morning)
- [ ] Test frontend indicator shows red on Sat/Sun/Mon/Tue when review not done
- [ ] Test frontend indicator does NOT show red while loading
