
-- Create contacts table
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  company TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Lead',
  added_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create deals table
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  value TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'Lead',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth yet)
CREATE POLICY "Allow all access to contacts" ON public.contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to deals" ON public.deals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);

-- Seed contacts
INSERT INTO public.contacts (name, email, phone, company, status, added_at) VALUES
  ('Sarah Chen', 'sarah@acme.co', '+1 555-0101', 'Acme Corp', 'Qualified', '2026-03-10'),
  ('James Wilson', 'james@globex.io', '+1 555-0102', 'Globex Inc', 'Lead', '2026-03-11'),
  ('Maria Rodriguez', 'maria@wayne.com', '+1 555-0103', 'Wayne Enterprises', 'Proposal', '2026-03-12'),
  ('David Park', 'david@stark.tech', '+1 555-0104', 'Stark Industries', 'Negotiation', '2026-03-12'),
  ('Emily Thompson', 'emily@oscorp.net', '+1 555-0105', 'Oscorp', 'Closed', '2026-03-13');

-- Seed deals
INSERT INTO public.deals (name, company, value, stage) VALUES
  ('Sarah Chen', 'Acme Corp', '$12,000', 'Lead'),
  ('James Wilson', 'Globex Inc', '$28,500', 'Lead'),
  ('Maria Rodriguez', 'Wayne Enterprises', '$45,000', 'Qualified'),
  ('David Park', 'Stark Industries', '$67,000', 'Proposal'),
  ('Emily Thompson', 'Oscorp', '$34,200', 'Proposal'),
  ('Alex Morgan', 'Umbrella Corp', '$89,000', 'Negotiation'),
  ('Lisa Wang', 'Cyberdyne', '$52,300', 'Closed'),
  ('Tom Baker', 'Initech', '$18,700', 'Qualified');

-- Seed tasks
INSERT INTO public.tasks (title, completed, priority, due_date) VALUES
  ('Follow up with Sarah Chen re: Acme proposal', false, 'high', '2026-03-14'),
  ('Prepare demo for Globex meeting', false, 'medium', '2026-03-15'),
  ('Send contract to Wayne Enterprises', true, 'high', '2026-03-12'),
  ('Update CRM pipeline stages', false, 'low', '2026-03-16'),
  ('Call David Park about pricing', false, 'medium', '2026-03-14');
