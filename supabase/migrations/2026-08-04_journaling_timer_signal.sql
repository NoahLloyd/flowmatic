-- Journaling completion is earned after 15 focused minutes and must be
-- monotonic for a given app day. Preserve the progress keys when an older or
-- concurrent client replaces the writings.activity_content JSON object.

CREATE OR REPLACE FUNCTION preserve_journaling_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  old_seconds INTEGER := 0;
  new_seconds INTEGER := 0;
  preserved_seconds INTEGER := 0;
  preserved_completed_at TEXT;
BEGIN
  NEW.activity_content := COALESCE(NEW.activity_content, '{}'::jsonb);

  IF jsonb_typeof(NEW.activity_content->'writingSeconds') = 'number' THEN
    new_seconds := FLOOR((NEW.activity_content->>'writingSeconds')::numeric);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF jsonb_typeof(OLD.activity_content->'writingSeconds') = 'number' THEN
      old_seconds := FLOOR((OLD.activity_content->>'writingSeconds')::numeric);
    END IF;
    preserved_completed_at := COALESCE(
      OLD.activity_content->>'journalingCompletedAt',
      NEW.activity_content->>'journalingCompletedAt'
    );
  ELSE
    preserved_completed_at := NEW.activity_content->>'journalingCompletedAt';
  END IF;

  preserved_seconds := LEAST(900, GREATEST(0, old_seconds, new_seconds));
  IF preserved_seconds >= 900 AND preserved_completed_at IS NULL THEN
    preserved_completed_at := NOW()::text;
  END IF;

  NEW.activity_content := jsonb_set(
    NEW.activity_content,
    '{writingSeconds}',
    to_jsonb(preserved_seconds),
    true
  );

  IF preserved_completed_at IS NOT NULL THEN
    NEW.activity_content := jsonb_set(
      NEW.activity_content,
      '{journalingCompletedAt}',
      to_jsonb(preserved_completed_at),
      true
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS preserve_journaling_progress_on_writings ON writings;
CREATE TRIGGER preserve_journaling_progress_on_writings
BEFORE INSERT OR UPDATE OF activity_content ON writings
FOR EACH ROW
EXECUTE FUNCTION preserve_journaling_progress();
