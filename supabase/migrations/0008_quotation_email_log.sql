-- Records when (and to which address) a quotation was emailed by the send-quotation function.
alter table public.biz_quotations add column if not exists emailed_at timestamptz, add column if not exists emailed_to text check (emailed_to is null or char_length(emailed_to) <= 254);
