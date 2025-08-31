-- Step 1: Add a temporary column for integer values
ALTER TABLE job_rods ADD COLUMN length_inches_temp INTEGER;

-- Step 2: Convert existing data to integers, handling common cases
UPDATE job_rods
SET length_inches_temp =
    CASE
        WHEN length_inches ~ '^[0-9]+$' THEN CAST(length_inches AS INTEGER) -- Pure integers
        WHEN length_inches ~ '^[0-9]+\\.?[0-9]*$' THEN CAST(CAST(length_inches AS NUMERIC) AS INTEGER) -- Truncate decimals
        ELSE 0 -- Default for invalid data (log these for review)
    END;

-- Step 3: Log invalid data for review
INSERT INTO logs (message, created_at) -- Assuming a logs table exists, or adjust logging mechanism
SELECT 'Invalid length_inches in job_rods, id: ' || id || ', value: ' || length_inches, NOW()
FROM job_rods
WHERE length_inches !~ '^[0-9]+\\.?[0-9]*$';

-- Step 4: Drop old column and rename new one
ALTER TABLE job_rods DROP COLUMN length_inches;
ALTER TABLE job_rods RENAME COLUMN length_inches_temp TO length_inches;

-- Step 5: Add NOT NULL constraint
ALTER TABLE job_rods ALTER COLUMN length_inches SET NOT NULL;
