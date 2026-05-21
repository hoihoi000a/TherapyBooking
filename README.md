# Therapy Preservation

C# ASP.NET Core project for displaying Supabase massage booking data in a browser.

## CSV-based models

The models in `Models/` were generated from the CSV files under `therapy_booking_csv/`:

- `appointments.csv` -> `Appointment`
- `payments.csv` -> `Payment`
- `reviews.csv` -> `Review`
- `roles.csv` -> `Role`
- `schedules.csv` -> `Schedule`
- `therapists.csv` -> `Therapist`
- `therapy_services.csv` -> `TherapyService`
- `users.csv` -> `User`

Each model uses Supabase PostgREST attributes:

- `[Table("table_name")]`
- `[PrimaryKey("id", false)]`
- `[Column("column_name")]`

## Run the booking page

PowerShell:

```powershell
$env:SUPABASE_URL='https://your-project-ref.supabase.co'
$env:SUPABASE_KEY='your-anon-or-service-role-key'
dotnet run --urls http://localhost:5078
```

Open:

http://localhost:5078

The page calls `/api/bookings`, which reads and joins these tables in the server process:

- `appointments`
- `payments`
- `reviews`
- `schedules`
- `therapists`
- `therapy_services`
- `users`

If REST returns `[]` while data exists in Supabase, check table name, schema, project URL, and Row Level Security policies for the key you are using.
