-- WhatsApp (15 October 2026): a WhatsApp Business phone number is a social_pages row with
-- platform 'WHATSAPP'. page_id holds the phone number ID, username the number as people see it,
-- and this column the WhatsApp Business account it belongs to (webhooks are subscribed on it).
ALTER TABLE social_pages ADD COLUMN whatsapp_business_id varchar(64);
