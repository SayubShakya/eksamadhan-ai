-- Weekly working hours: when a person is willing to be handed new conversations.
-- A JSON array of windows, [{"dayOfWeek":0-6 (0 = Sunday), "startMin":540, "endMin":1080}],
-- in minutes from midnight in the person's own wall-clock time (time_zone), not UTC instants:
-- the rule is "9 to 6 on Mondays", whatever the server's clock or the date's offset.
-- An empty array means not accepting new conversations.
ALTER TABLE users ADD COLUMN working_hours text NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN time_zone varchar(64) NOT NULL DEFAULT 'Asia/Kathmandu';

-- Everyone who exists now keeps being routed to as before: every day, all day, written out,
-- so their hours page shows what is really in force and they can narrow it. People invited
-- from here on start with none, and are asked to set them.
UPDATE users SET working_hours =
    '[{"dayOfWeek":0,"startMin":0,"endMin":1440},{"dayOfWeek":1,"startMin":0,"endMin":1440},'
    || '{"dayOfWeek":2,"startMin":0,"endMin":1440},{"dayOfWeek":3,"startMin":0,"endMin":1440},'
    || '{"dayOfWeek":4,"startMin":0,"endMin":1440},{"dayOfWeek":5,"startMin":0,"endMin":1440},'
    || '{"dayOfWeek":6,"startMin":0,"endMin":1440}]';
