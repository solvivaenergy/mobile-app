-- Solviva Seed Data
-- Run this AFTER schema.sql in Supabase SQL Editor
--
-- IMPORTANT: First create a test user via Supabase Auth (Dashboard > Authentication > Users > Add user)
--   Email: marco.santos@email.com
--   Password: test123456
-- Then replace the UUID below with the actual user ID from the Auth dashboard.

-- ============================================================
-- Global app support contact settings
-- ============================================================
INSERT INTO
    public.support_contacts (
        id,
        support_phone,
        support_email,
        helpdesk_url,
        emergency_phone,
        operating_hours
    )
VALUES (
        1,
        '+639178412254',
        'tech.support@solvivaenergy.com',
        'https://helpdesk.solviva.ph',
        '+639178412254',
        '8:00 AM - 6:00 PM, Mon-Sat'
    ) ON CONFLICT (id) DO
UPDATE
SET
    support_phone = EXCLUDED.support_phone,
    support_email = EXCLUDED.support_email,
    helpdesk_url = EXCLUDED.helpdesk_url,
    emergency_phone = EXCLUDED.emergency_phone,
    operating_hours = EXCLUDED.operating_hours,
    updated_at = NOW();

-- ============================================================
-- Step 1: Set the test user UUID (replace with your actual user ID)
-- ============================================================
DO $$
DECLARE
    test_user_id UUID := '5472a605-07e9-4ae9-92a1-93efb2258746'; -- REPLACE THIS with real auth.users id
    system_id UUID;
    ticket1_id UUID;
    ticket2_id UUID;
BEGIN

-- ============================================================
-- Step 2: User Profile
-- ============================================================
INSERT INTO public.user_profiles (id, full_name, phone, address, solis_station_id)
VALUES (
    test_user_id,
    'Marco Santos',
    '+63 917 123 4567',
    '123 Solar St, Quezon City, Metro Manila',
    NULL  -- Set to actual Solis station ID to enable sync
);

-- ============================================================
-- Step 3: Solar System
-- ============================================================
INSERT INTO public.solar_systems (id, user_id, system_name, capacity_kwp, installation_date, battery_capacity_kwh, address, status)
VALUES (
    uuid_generate_v4(),
    test_user_id,
    'Santos Residence Solar',
    5.00,
    '2025-10-15',
    10.00,
    '123 Solar St, Quezon City, Metro Manila',
    'active'
)
RETURNING id INTO system_id;

-- ============================================================
-- Step 4: Energy Readings (today's hourly data)
-- ============================================================
INSERT INTO public.energy_readings (user_id, system_id, timestamp, production_kwh, consumption_kwh, battery_level, battery_status, grid_import_kwh, grid_export_kwh) VALUES
    (test_user_id, system_id, NOW()::date + INTERVAL '6 hours',  0.20, 1.10, 65.00, 'discharging', 0.90, 0.00),
    (test_user_id, system_id, NOW()::date + INTERVAL '7 hours',  1.20, 1.20, 67.00, 'charging',    0.00, 0.00),
    (test_user_id, system_id, NOW()::date + INTERVAL '8 hours',  2.80, 1.50, 70.00, 'charging',    0.00, 0.30),
    (test_user_id, system_id, NOW()::date + INTERVAL '9 hours',  3.80, 1.80, 75.00, 'charging',    0.00, 1.00),
    (test_user_id, system_id, NOW()::date + INTERVAL '10 hours', 4.50, 2.00, 80.00, 'charging',    0.00, 1.50),
    (test_user_id, system_id, NOW()::date + INTERVAL '11 hours', 5.00, 2.10, 85.00, 'charging',    0.00, 1.90),
    (test_user_id, system_id, NOW()::date + INTERVAL '12 hours', 5.20, 2.30, 90.00, 'charging',    0.00, 2.00),
    (test_user_id, system_id, NOW()::date + INTERVAL '13 hours', 5.00, 2.40, 93.00, 'charging',    0.00, 1.60),
    (test_user_id, system_id, NOW()::date + INTERVAL '14 hours', 4.80, 2.50, 95.00, 'full',        0.00, 1.80),
    (test_user_id, system_id, NOW()::date + INTERVAL '15 hours', 3.80, 2.60, 94.00, 'discharging', 0.00, 0.70),
    (test_user_id, system_id, NOW()::date + INTERVAL '16 hours', 3.00, 2.80, 92.00, 'discharging', 0.00, 0.20),
    (test_user_id, system_id, NOW()::date + INTERVAL '17 hours', 1.50, 3.00, 88.00, 'discharging', 0.50, 0.00),
    (test_user_id, system_id, NOW()::date + INTERVAL '18 hours', 0.50, 3.20, 85.00, 'discharging', 0.50, 0.00),
    (test_user_id, system_id, NOW()::date + INTERVAL '19 hours', 0.00, 3.50, 80.00, 'discharging', 1.50, 0.00),
    (test_user_id, system_id, NOW()::date + INTERVAL '20 hours', 0.00, 3.00, 75.00, 'discharging', 1.00, 0.00);

-- Past 7 days of daily summary readings
INSERT INTO public.energy_readings (user_id, system_id, timestamp, production_kwh, consumption_kwh, battery_level, battery_status, grid_import_kwh, grid_export_kwh) VALUES
    (test_user_id, system_id, NOW() - INTERVAL '7 days', 5.80, 4.20, 72.00, 'idle', 1.20, 2.80),
    (test_user_id, system_id, NOW() - INTERVAL '6 days', 6.20, 3.80, 78.00, 'idle', 0.80, 3.20),
    (test_user_id, system_id, NOW() - INTERVAL '5 days', 4.50, 5.10, 65.00, 'idle', 2.50, 1.90),
    (test_user_id, system_id, NOW() - INTERVAL '4 days', 7.10, 4.50, 82.00, 'idle', 0.40, 3.00),
    (test_user_id, system_id, NOW() - INTERVAL '3 days', 6.80, 4.00, 80.00, 'idle', 0.50, 3.30),
    (test_user_id, system_id, NOW() - INTERVAL '2 days', 5.20, 5.50, 68.00, 'idle', 2.80, 2.50),
    (test_user_id, system_id, NOW() - INTERVAL '1 day',  6.50, 4.80, 75.00, 'idle', 1.00, 2.70);

-- ============================================================
-- Step 5: Support Tickets
-- ============================================================
INSERT INTO public.support_tickets (id, user_id, subject, description, status, priority, created_at, updated_at)
VALUES (
    uuid_generate_v4(),
    test_user_id,
    'Inverter not responding',
    'My inverter has been offline since yesterday morning. The LED indicator is blinking red and I cannot see any production data in the app.',
    'in_progress',
    'high',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '2 days'
)
RETURNING id INTO ticket1_id;

INSERT INTO public.support_tickets (id, user_id, subject, description, status, priority, created_at, updated_at)
VALUES (
    uuid_generate_v4(),
    test_user_id,
    'Net metering application status',
    'I would like to check the status of my net metering application submitted last month to Meralco.',
    'resolved',
    'medium',
    NOW() - INTERVAL '18 days',
    NOW() - INTERVAL '13 days'
)
RETURNING id INTO ticket2_id;

-- ============================================================
-- Step 6: Ticket Messages
-- ============================================================
INSERT INTO public.ticket_messages (ticket_id, user_id, message, is_staff, created_at) VALUES
    (ticket1_id, test_user_id, 'My inverter has been offline since yesterday morning. The LED indicator is blinking red.', FALSE, NOW() - INTERVAL '3 days'),
    (ticket1_id, test_user_id, 'Hi Marco, thank you for reporting this. Please try a hard reset: turn off the inverter breaker, wait 60 seconds, then turn it back on. If the red LED persists, we will schedule a technician visit.', TRUE, NOW() - INTERVAL '2 days' + INTERVAL '4 hours'),
    (ticket1_id, test_user_id, 'Thank you. I will try the reset procedure now.', FALSE, NOW() - INTERVAL '2 days' + INTERVAL '6 hours');

INSERT INTO public.ticket_messages (ticket_id, user_id, message, is_staff, created_at) VALUES
    (ticket2_id, test_user_id, 'Hi, I submitted my net metering application to Meralco last month. Can you check the status?', FALSE, NOW() - INTERVAL '18 days'),
    (ticket2_id, test_user_id, 'Your net metering application has been approved by Meralco. The bi-directional meter installation is scheduled for next week. You will receive an SMS confirmation with the exact date.', TRUE, NOW() - INTERVAL '15 days'),
    (ticket2_id, test_user_id, 'Great news! Thank you for the update.', FALSE, NOW() - INTERVAL '14 days');

-- ============================================================
-- Step 7: Referrals
-- ============================================================
INSERT INTO public.referrals (referrer_user_id, referee_name, referee_phone, referee_email, status, referral_code, estimated_earnings, actual_earnings, paid_at, created_at) VALUES
    (test_user_id, 'Ana Reyes',   '+63 918 555 1234', 'ana.reyes@email.com',   'installed', 'MARCO2026-001', 10000.00, 10000.00, NOW() - INTERVAL '30 days', NOW() - INTERVAL '80 days'),
    (test_user_id, 'Jose Garcia', '+63 917 555 5678', 'jose.garcia@email.com', 'qualified', 'MARCO2026-002', 10000.00, NULL,     NULL,                       NOW() - INTERVAL '44 days'),
    (test_user_id, 'Maria Cruz',  '+63 919 555 9012', 'maria.cruz@email.com',  'pending',   'MARCO2026-003', 10000.00, NULL,     NULL,                       NOW() - INTERVAL '8 days'),
    (test_user_id, 'Pedro Lim',   '+63 920 555 3456', 'pedro.lim@email.com',   'paid',      'MARCO2026-004', 10000.00, 10000.00, NOW() - INTERVAL '60 days', NOW() - INTERVAL '120 days'),
    (test_user_id, 'Lisa Tan',    '+63 921 555 7890', NULL,                     'rejected',  'MARCO2026-005', 10000.00, NULL,     NULL,                       NOW() - INTERVAL '90 days');

-- ============================================================
-- Step 8: Energy Tips
-- ============================================================
INSERT INTO public.energy_tips (user_id, tip_type, title, content, potential_savings_php, is_read) VALUES
    (test_user_id, 'efficiency',  'Shift Heavy Loads to Peak Solar Hours',  'Run your washing machine, dryer, and dishwasher between 10am-2pm when your solar panels produce the most energy. This maximizes self-consumption and reduces grid imports.', 350.00, FALSE),
    (test_user_id, 'maintenance', 'Clean Your Solar Panels Monthly',        'Dust and debris can reduce panel efficiency by up to 25%. Schedule a monthly cleaning during dry season for optimal performance.', 200.00, TRUE),
    (test_user_id, 'savings',     'Set AC to 25°C for Best Efficiency',     'Each degree below 25°C increases energy consumption by 3-5%. Use your aircon''s timer during solar hours for free cooling.', 500.00, FALSE),
    (test_user_id, 'efficiency',  'Battery Charging Optimization',          'Your battery charges fastest between 10am-3pm. Avoid heavy loads during this time to ensure full charge before evening peak hours.', 150.00, FALSE),
    (test_user_id, 'alert',       'Unusual Consumption Detected',           'Your consumption yesterday was 35% higher than your weekly average. Check if any appliances were left running or if there is a faulty device.', NULL, FALSE),
    (test_user_id, 'savings',     'Switch to LED Lighting',                 'Replacing all remaining incandescent or CFL bulbs with LED saves up to 80% on lighting costs. With solar, your payback period is even shorter.', 250.00, TRUE);

-- ============================================================
-- Step 9: Billing Records
-- ============================================================
INSERT INTO public.billing_records (user_id, billing_period_start, billing_period_end, amount_php, payment_type, status, due_date, paid_at) VALUES
    (test_user_id, '2025-11-01', '2025-11-30', 7800.00, 'rto', 'paid',    '2025-12-15', '2025-12-10 09:30:00+08'),
    (test_user_id, '2025-12-01', '2025-12-31', 7800.00, 'rto', 'paid',    '2026-01-15', '2026-01-12 14:15:00+08'),
    (test_user_id, '2026-01-01', '2026-01-31', 7800.00, 'rto', 'paid',    '2026-02-15', '2026-02-13 10:00:00+08'),
    (test_user_id, '2026-02-01', '2026-02-28', 7800.00, 'rto', 'pending', '2026-03-15', NULL),
    (test_user_id, '2025-10-01', '2026-03-31', 1500.00, 'maintenance', 'paid',    '2025-10-15', '2025-10-15 08:00:00+08'),
    (test_user_id, '2026-04-01', '2026-09-30', 1500.00, 'maintenance', 'pending', '2026-04-15', NULL);

-- ============================================================
-- Done!
-- ============================================================
RAISE NOTICE 'Seed data inserted successfully for user: %', test_user_id;
RAISE NOTICE 'Solar system ID: %', system_id;
RAISE NOTICE 'Support tickets: % and %', ticket1_id, ticket2_id;

END $$;