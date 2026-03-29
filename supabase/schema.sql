-- Solviva Mobile App Database Schema
-- To be executed in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.user_profiles (
    id UUID REFERENCES auth.users (id) PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    solis_station_id TEXT, -- Maps this user to a Solis Cloud station
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Solar Systems
CREATE TABLE public.solar_systems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID REFERENCES auth.users (id) NOT NULL,
    system_name TEXT NOT NULL,
    capacity_kwp DECIMAL(10, 2) NOT NULL,
    installation_date DATE NOT NULL,
    battery_capacity_kwh DECIMAL(10, 2),
    address TEXT NOT NULL,
    status TEXT NOT NULL CHECK (
        status IN (
            'active',
            'inactive',
            'maintenance'
        )
    ),
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Energy Readings
CREATE TABLE public.energy_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID REFERENCES auth.users (id) NOT NULL,
    system_id UUID REFERENCES public.solar_systems (id) NOT NULL,
    timestamp TIMESTAMP
    WITH
        TIME ZONE NOT NULL,
        production_kwh DECIMAL(10, 4) NOT NULL,
        consumption_kwh DECIMAL(10, 4) NOT NULL,
        battery_level DECIMAL(5, 2),
        battery_status TEXT CHECK (
            battery_status IN (
                'charging',
                'discharging',
                'idle',
                'full'
            )
        ),
        grid_import_kwh DECIMAL(10, 4) DEFAULT 0,
        grid_export_kwh DECIMAL(10, 4) DEFAULT 0,
        created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Support Tickets
CREATE TABLE public.support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID REFERENCES auth.users (id) NOT NULL,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL CHECK (
        status IN (
            'open',
            'in_progress',
            'resolved',
            'closed'
        )
    ) DEFAULT 'open',
    priority TEXT NOT NULL CHECK (
        priority IN (
            'low',
            'medium',
            'high',
            'urgent'
        )
    ) DEFAULT 'medium',
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- App-level support contact settings (single-row config)
CREATE TABLE public.support_contacts (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    support_phone TEXT NOT NULL,
    support_email TEXT NOT NULL,
    helpdesk_url TEXT,
    emergency_phone TEXT,
    operating_hours TEXT,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Ticket Messages (for chat history)
CREATE TABLE public.ticket_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    ticket_id UUID REFERENCES public.support_tickets (id) NOT NULL,
    user_id UUID REFERENCES auth.users (id),
    message TEXT NOT NULL,
    is_staff BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Referrals
CREATE TABLE public.referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    referrer_user_id UUID REFERENCES auth.users (id) NOT NULL,
    referee_name TEXT NOT NULL,
    referee_phone TEXT NOT NULL,
    referee_email TEXT,
    status TEXT NOT NULL CHECK (
        status IN (
            'pending',
            'qualified',
            'installed',
            'paid',
            'rejected'
        )
    ) DEFAULT 'pending',
    referral_code TEXT NOT NULL,
    estimated_earnings DECIMAL(10, 2) DEFAULT 10000,
    actual_earnings DECIMAL(10, 2),
    paid_at TIMESTAMP
    WITH
        TIME ZONE,
        created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Energy Tips
CREATE TABLE public.energy_tips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID REFERENCES auth.users (id) NOT NULL,
    tip_type TEXT NOT NULL CHECK (
        tip_type IN (
            'savings',
            'maintenance',
            'efficiency',
            'alert'
        )
    ),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    potential_savings_php DECIMAL(10, 2),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Billing & Payments
CREATE TABLE public.billing_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID REFERENCES auth.users (id) NOT NULL,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    amount_php DECIMAL(10, 2) NOT NULL,
    payment_type TEXT CHECK (
        payment_type IN ('rto', 'maintenance', 'other')
    ),
    status TEXT CHECK (
        status IN (
            'pending',
            'paid',
            'overdue',
            'cancelled'
        )
    ) DEFAULT 'pending',
    due_date DATE NOT NULL,
    paid_at TIMESTAMP
    WITH
        TIME ZONE,
        created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_energy_readings_user_timestamp ON public.energy_readings (user_id, timestamp DESC);

CREATE INDEX idx_energy_readings_system_timestamp ON public.energy_readings (system_id, timestamp DESC);

CREATE INDEX idx_support_tickets_user ON public.support_tickets (user_id, created_at DESC);

CREATE INDEX idx_referrals_user ON public.referrals (
    referrer_user_id,
    created_at DESC
);

CREATE INDEX idx_energy_tips_user ON public.energy_tips (user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.solar_systems ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.energy_readings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.energy_tips ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_records ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.support_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only access their own data
CREATE POLICY "Users can view their own profile" ON public.user_profiles FOR
SELECT USING (auth.uid () = id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles FOR
UPDATE USING (auth.uid () = id);

CREATE POLICY "Users can view their solar systems" ON public.solar_systems FOR
SELECT USING (auth.uid () = user_id);

CREATE POLICY "Users can view their energy readings" ON public.energy_readings FOR
SELECT USING (auth.uid () = user_id);

CREATE POLICY "Users can view their support tickets" ON public.support_tickets FOR
SELECT USING (auth.uid () = user_id);

CREATE POLICY "Users can create support tickets" ON public.support_tickets FOR
INSERT
WITH
    CHECK (auth.uid () = user_id);

CREATE POLICY "Users can view ticket messages" ON public.ticket_messages FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.support_tickets
            WHERE
                id = ticket_messages.ticket_id
                AND user_id = auth.uid ()
        )
    );

CREATE POLICY "Users can create ticket messages" ON public.ticket_messages FOR
INSERT
WITH
    CHECK (auth.uid () = user_id);

CREATE POLICY "Users can view their referrals" ON public.referrals FOR
SELECT USING (
        auth.uid () = referrer_user_id
    );

CREATE POLICY "Users can create referrals" ON public.referrals FOR
INSERT
WITH
    CHECK (
        auth.uid () = referrer_user_id
    );

CREATE POLICY "Users can view their energy tips" ON public.energy_tips FOR
SELECT USING (auth.uid () = user_id);

CREATE POLICY "Users can update their energy tips" ON public.energy_tips FOR
UPDATE USING (auth.uid () = user_id);

CREATE POLICY "Users can view their billing records" ON public.billing_records FOR
SELECT USING (auth.uid () = user_id);

CREATE POLICY "Authenticated users can view support contacts" ON public.support_contacts FOR
SELECT USING (auth.uid () IS NOT NULL);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_solar_systems_updated_at BEFORE UPDATE ON public.solar_systems
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_contacts_updated_at BEFORE UPDATE ON public.support_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- Service-role INSERT policies for sync service
-- (service role bypasses RLS, but these allow
--  a dedicated sync user if needed in future)
-- ===========================================
CREATE POLICY "Service can insert energy readings" ON public.energy_readings FOR
INSERT
WITH
    CHECK (true);

CREATE POLICY "Service can update solar systems" ON public.solar_systems FOR
UPDATE USING (true);