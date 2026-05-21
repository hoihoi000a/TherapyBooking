using System.Text.Json;
using System.Text.Json.Serialization;
using Supabase;
using Supabase.Postgrest.Models;
using TherapyPreservation.Models;

namespace TherapyPreservation;

internal static class Program
{
    private const string DefaultSupabaseUrl = "https://paohtsanziftkgbquvqq.supabase.co";
    private const string DefaultSupabaseKey = "sb_publishable_0f4DSU_u1dvkagDcRAURbw_E0GRuPxd";
    private const string DefaultSchema = "public";
    private static readonly HashSet<string> ValidStatuses = ["pending", "confirmed", "completed", "cancelled"];

    private static async Task Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        builder.Services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
        });

        builder.Services.AddSingleton(_ =>
        {
            var supabaseUrl = Environment.GetEnvironmentVariable("SUPABASE_URL") ?? DefaultSupabaseUrl;
            var supabaseKey = Environment.GetEnvironmentVariable("SUPABASE_KEY") ?? DefaultSupabaseKey;
            var schema = Environment.GetEnvironmentVariable("SUPABASE_SCHEMA") ?? DefaultSchema;

            var client = new Client(
                supabaseUrl,
                supabaseKey,
                new SupabaseOptions
                {
                    AutoRefreshToken = true,
                    AutoConnectRealtime = false,
                    Schema = schema
                });

            client.InitializeAsync().GetAwaiter().GetResult();
            return client;
        });

        var app = builder.Build();

        app.UseStaticFiles();

        app.MapGet("/", () => Results.File(Path.Combine(app.Environment.WebRootPath, "home.html"), "text/html"));
        app.MapGet("/home", () => Results.File(Path.Combine(app.Environment.WebRootPath, "home.html"), "text/html"));
        app.MapGet("/booking", () => Results.File(Path.Combine(app.Environment.WebRootPath, "booking.html"), "text/html"));
        app.MapGet("/booking-status", () => Results.File(Path.Combine(app.Environment.WebRootPath, "booking-status.html"), "text/html"));
        app.MapGet("/admin", () => Results.File(Path.Combine(app.Environment.WebRootPath, "reservation.html"), "text/html"));
        app.MapGet("/admin/revenue", () => Results.File(Path.Combine(app.Environment.WebRootPath, "revenue.html"), "text/html"));
        app.MapGet("/admin/reservations", () => Results.File(Path.Combine(app.Environment.WebRootPath, "reservation.html"), "text/html"));
        app.MapGet("/admin/responses", () => Results.File(Path.Combine(app.Environment.WebRootPath, "responses.html"), "text/html"));
        app.MapGet("/admin/therapist-schedules", () => Results.File(Path.Combine(app.Environment.WebRootPath, "therapist-schedules.html"), "text/html"));
        app.MapGet("/booking-success", () => Results.File(Path.Combine(app.Environment.WebRootPath, "success.html"), "text/html"));
        app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

        app.MapGet("/api/services", async (Client supabase) =>
        {
            var services = await GetModelsAsync<TherapyService>(supabase);
            var result = services
                .Where(service => service.IsActive)
                .OrderBy(service => service.Price)
                .Select(service => new ServiceOption(
                    service.Id,
                    service.ServiceName,
                    service.Description,
                    service.DurationMinutes,
                    service.Price))
                .ToList();

            return Results.Ok(result);
        });

        app.MapGet("/api/schedules/available", async (Client supabase) =>
        {
            var schedules = await GetModelsAsync<Schedule>(supabase);
            var therapists = await GetModelsAsync<Therapist>(supabase);
            var users = await GetModelsAsync<User>(supabase);

            var therapistsById = therapists.ToDictionary(therapist => therapist.Id);
            var usersById = users.ToDictionary(user => user.Id);

            var result = schedules
                .Where(schedule => schedule.IsAvailable && schedule.StartTime >= DateTime.Today)
                .OrderBy(schedule => schedule.StartTime)
                .Select(schedule =>
                {
                    therapistsById.TryGetValue(schedule.TherapistId, out var therapist);
                    User? therapistUser = null;
                    if (therapist is not null)
                    {
                        usersById.TryGetValue(therapist.UserId, out therapistUser);
                    }

                    return new ScheduleOption(
                        schedule.Id,
                        schedule.TherapistId,
                        therapistUser?.FullName ?? therapist?.TherapistCode ?? $"Therapist #{schedule.TherapistId}",
                        therapist?.TherapistCode,
                        schedule.StartTime,
                        schedule.EndTime);
                })
                .ToList();

            return Results.Ok(result);
        });

        app.MapGet("/api/booking-slots", async (Client supabase) =>
        {
            var result = await BuildBookingSlotsAsync(supabase, onlyAvailable: true);
            return Results.Ok(result);
        });

        app.MapGet("/api/admin/therapists", async (Client supabase) =>
        {
            var therapists = await GetModelsAsync<Therapist>(supabase);
            var users = await GetModelsAsync<User>(supabase);
            var usersById = users.ToDictionary(user => user.Id);

            var result = therapists
                .OrderBy(therapist => therapist.Id)
                .Select(therapist =>
                {
                    usersById.TryGetValue(therapist.UserId, out var user);
                    return new TherapistOption(
                        therapist.Id,
                        therapist.TherapistCode,
                        user?.FullName ?? therapist.TherapistCode,
                        therapist.IsAvailable);
                })
                .ToList();

            return Results.Ok(result);
        });

        app.MapGet("/api/admin/schedules", async (Client supabase, long? therapistId) =>
        {
            var schedules = await GetModelsAsync<Schedule>(supabase);
            var therapists = await GetModelsAsync<Therapist>(supabase);
            var users = await GetModelsAsync<User>(supabase);
            var therapistsById = therapists.ToDictionary(therapist => therapist.Id);
            var usersById = users.ToDictionary(user => user.Id);

            var result = schedules
                .Where(schedule => therapistId is null || schedule.TherapistId == therapistId)
                .OrderBy(schedule => schedule.StartTime)
                .Select(schedule =>
                {
                    therapistsById.TryGetValue(schedule.TherapistId, out var therapist);
                    User? therapistUser = null;
                    if (therapist is not null)
                    {
                        usersById.TryGetValue(therapist.UserId, out therapistUser);
                    }

                    return new AdminScheduleRow(
                        schedule.Id,
                        schedule.TherapistId,
                        therapist?.TherapistCode ?? $"TH{schedule.TherapistId:000}",
                        therapistUser?.FullName ?? therapist?.TherapistCode ?? $"Therapist #{schedule.TherapistId}",
                        schedule.StartTime,
                        schedule.EndTime,
                        schedule.IsAvailable,
                        schedule.CreatedAt);
                })
                .ToList();

            return Results.Ok(result);
        });

        app.MapGet("/api/bookings", async (Client supabase) =>
        {
            var response = await BuildBookingResponseAsync(supabase);
            return Results.Ok(response);
        });

        app.MapGet("/api/public/bookings/upcoming", async (Client supabase) =>
        {
            var response = await BuildBookingResponseAsync(supabase);
            var endDate = DateTime.Today.AddDays(7);
            var result = response.Bookings
                .Where(booking => booking.StartTime >= DateTime.Now && booking.StartTime < endDate)
                .OrderBy(booking => booking.StartTime)
                .Select(booking => new PublicBookingRow(
                    booking.AppointmentNo,
                    booking.Status,
                    booking.CustomerName,
                    booking.ServiceName,
                    booking.TherapistName,
                    booking.StartTime,
                    booking.EndTime))
                .ToList();

            return Results.Ok(result);
        });

        app.MapPost("/api/bookings", async (Client supabase, CreateBookingRequest request) =>
        {
            var validationError = ValidateCreateBookingRequest(request);
            if (validationError is not null)
            {
                return Results.BadRequest(new { message = validationError });
            }

            var services = await GetModelsAsync<TherapyService>(supabase);
            var appointments = await GetModelsAsync<Appointment>(supabase);
            var slot = (await BuildBookingSlotsAsync(supabase, onlyAvailable: true))
                .SingleOrDefault(item => item.SlotId == request.SlotId);

            if (slot is null)
            {
                return Results.BadRequest(new { message = "Selected slot is no longer available." });
            }

            var service = services.SingleOrDefault(item => item.Id == request.ServiceId && item.IsActive);
            if (service is null)
            {
                return Results.BadRequest(new { message = "Selected service is not available." });
            }

            var schedules = await GetModelsAsync<Schedule>(supabase);
            var schedule = schedules.FirstOrDefault(item =>
                item.TherapistId == slot.TherapistId &&
                SameMinute(item.StartTime, slot.StartTime) &&
                SameMinute(item.EndTime, slot.EndTime));

            if (schedule is null)
            {
                var scheduleInsert = await supabase.From<Schedule>().Insert(new Schedule
                {
                    TherapistId = slot.TherapistId,
                    StartTime = slot.StartTime,
                    EndTime = slot.EndTime,
                    IsAvailable = false,
                    CreatedAt = DateTime.Now
                });
                schedule = scheduleInsert.Models.FirstOrDefault();
            }
            else if (schedule.IsAvailable)
            {
                await supabase
                    .From<Schedule>()
                    .Where(item => item.Id == schedule.Id)
                    .Set(item => item.IsAvailable, false)
                    .Update();
            }

            if (schedule is null || schedule.Id <= 0)
            {
                return Results.BadRequest(new { message = "Unable to reserve selected slot." });
            }

            var todaySequence = appointments.Count(item => item.AppointmentDate.Date == slot.StartTime.Date) + 1;
            var now = DateTime.Now;
            var appointment = new Appointment
            {
                AppointmentNo = $"APT{slot.StartTime:yyyyMMdd}{todaySequence:000}",
                UserId = 1,
                TherapistId = slot.TherapistId,
                ServiceId = service.Id,
                ScheduleId = schedule.Id,
                AppointmentDate = slot.StartTime.Date,
                StartTime = slot.StartTime,
                EndTime = slot.EndTime,
                Status = "pending",
                CustomerNote = request.Note,
                AdminNote = BuildCustomerMeta(request),
                CreatedAt = now,
                UpdatedAt = now
            };

            var insertResult = await supabase.From<Appointment>().Insert(appointment);
            var created = insertResult.Models.FirstOrDefault() ?? appointment;

            return Results.Created($"/api/bookings/{created.Id}", new
            {
                message = "Booking created.",
                booking = new
                {
                    created.Id,
                    created.AppointmentNo,
                    created.Status,
                    serviceName = service.ServiceName,
                    therapistId = slot.TherapistId,
                    created.StartTime,
                    created.EndTime
                }
            });
        });

        app.MapPost("/api/admin/schedules", async (Client supabase, CreateScheduleRequest request) =>
        {
            var validationError = ValidateScheduleRequest(request);
            if (validationError is not null)
            {
                return Results.BadRequest(new { message = validationError });
            }

            var therapists = await GetModelsAsync<Therapist>(supabase);
            if (therapists.All(therapist => therapist.Id != request.TherapistId))
            {
                return Results.BadRequest(new { message = "Therapist not found." });
            }

            var schedule = new Schedule
            {
                TherapistId = request.TherapistId,
                StartTime = request.StartTime,
                EndTime = request.EndTime,
                IsAvailable = request.IsAvailable,
                CreatedAt = DateTime.Now
            };

            var result = await supabase.From<Schedule>().Insert(schedule);
            return Results.Created("/api/admin/schedules", result.Models.FirstOrDefault() ?? schedule);
        });

        app.MapPost("/api/admin/schedules/day", async (Client supabase, DayScheduleRequest request) =>
        {
            var date = request.Date.Date;
            var therapists = await GetModelsAsync<Therapist>(supabase);
            if (therapists.All(therapist => therapist.Id != request.TherapistId))
            {
                return Results.BadRequest(new { message = "Therapist not found." });
            }

            var schedules = await GetModelsAsync<Schedule>(supabase);
            var appointments = await GetModelsAsync<Appointment>(supabase);
            var daySchedules = schedules
                .Where(item => item.TherapistId == request.TherapistId && item.StartTime.Date == date)
                .ToList();
            var bookedKeys = appointments
                .Where(item => item.TherapistId == request.TherapistId)
                .Where(item => item.StartTime.Date == date)
                .Where(item => !string.Equals(item.Status, "cancelled", StringComparison.OrdinalIgnoreCase))
                .Select(item => SlotKey(item.StartTime))
                .ToHashSet(StringComparer.Ordinal);

            var changed = 0;
            foreach (var slot in GenerateFixedDaySlotTimes(date))
            {
                var existing = daySchedules.FirstOrDefault(item =>
                    SameMinute(item.StartTime, slot.StartTime) &&
                    SameMinute(item.EndTime, slot.EndTime));
                var shouldOpen = request.IsBusinessDay && !bookedKeys.Contains(SlotKey(slot.StartTime));

                if (existing is null)
                {
                    if (!request.IsBusinessDay)
                    {
                        continue;
                    }

                    await supabase.From<Schedule>().Insert(new Schedule
                    {
                        TherapistId = request.TherapistId,
                        StartTime = slot.StartTime,
                        EndTime = slot.EndTime,
                        IsAvailable = shouldOpen,
                        CreatedAt = DateTime.Now
                    });
                    changed++;
                    continue;
                }

                if (existing.IsAvailable != shouldOpen)
                {
                    await supabase
                        .From<Schedule>()
                        .Where(item => item.Id == existing.Id)
                        .Set(item => item.IsAvailable, shouldOpen)
                        .Update();
                    changed++;
                }
            }

            return Results.Ok(new
            {
                message = request.IsBusinessDay ? "Business day opened." : "Business day closed.",
                request.TherapistId,
                date,
                isBusinessDay = request.IsBusinessDay,
                changed
            });
        });

        app.MapPost("/api/admin/schedules/slot", async (Client supabase, SlotScheduleRequest request) =>
        {
            if (request.TherapistId <= 0 || request.EndTime <= request.StartTime)
            {
                return Results.BadRequest(new { message = "Invalid slot request." });
            }

            var therapists = await GetModelsAsync<Therapist>(supabase);
            if (therapists.All(therapist => therapist.Id != request.TherapistId))
            {
                return Results.BadRequest(new { message = "Therapist not found." });
            }

            var appointments = await GetModelsAsync<Appointment>(supabase);
            var isBooked = appointments.Any(item =>
                item.TherapistId == request.TherapistId &&
                SameMinute(item.StartTime, request.StartTime) &&
                !string.Equals(item.Status, "cancelled", StringComparison.OrdinalIgnoreCase));

            if (isBooked && !request.IsAvailable)
            {
                return Results.BadRequest(new { message = "This slot already has a booking and cannot be closed." });
            }

            var schedules = await GetModelsAsync<Schedule>(supabase);
            var existing = schedules.FirstOrDefault(item =>
                item.TherapistId == request.TherapistId &&
                SameMinute(item.StartTime, request.StartTime) &&
                SameMinute(item.EndTime, request.EndTime));

            if (existing is null)
            {
                var insertResult = await supabase.From<Schedule>().Insert(new Schedule
                {
                    TherapistId = request.TherapistId,
                    StartTime = request.StartTime,
                    EndTime = request.EndTime,
                    IsAvailable = request.IsAvailable,
                    CreatedAt = DateTime.Now
                });
                var created = insertResult.Models.FirstOrDefault();

                return Results.Created("/api/admin/schedules/slot", new
                {
                    message = "Slot created.",
                    id = created?.Id,
                    request.TherapistId,
                    request.StartTime,
                    request.EndTime,
                    request.IsAvailable
                });
            }

            var result = await supabase
                .From<Schedule>()
                .Where(item => item.Id == existing.Id)
                .Set(item => item.IsAvailable, request.IsAvailable)
                .Update();

            return Results.Ok(new { message = "Slot updated.", count = result.Models.Count });
        });

        app.MapPatch("/api/admin/bookings/{id:long}/status", async (Client supabase, long id, UpdateBookingStatusRequest request) =>
        {
            var status = request.Status.Trim().ToLowerInvariant();
            if (!ValidStatuses.Contains(status))
            {
                return Results.BadRequest(new { message = "Unsupported booking status." });
            }

            var result = await supabase
                .From<Appointment>()
                .Where(item => item.Id == id)
                .Set(item => item.Status, status)
                .Set(item => item.UpdatedAt, DateTime.Now)
                .Update();

            return Results.Ok(new { message = "Booking status updated.", count = result.Models.Count });
        });

        app.MapPatch("/api/admin/schedules/{id:long}", async (Client supabase, long id, UpdateScheduleRequest request) =>
        {
            var validationError = ValidateScheduleRequest(request);
            if (validationError is not null)
            {
                return Results.BadRequest(new { message = validationError });
            }

            var result = await supabase
                .From<Schedule>()
                .Where(item => item.Id == id)
                .Set(item => item.TherapistId, request.TherapistId)
                .Set(item => item.StartTime, request.StartTime)
                .Set(item => item.EndTime, request.EndTime)
                .Set(item => item.IsAvailable, request.IsAvailable)
                .Update();

            return Results.Ok(new { message = "Schedule updated.", count = result.Models.Count });
        });

        await app.RunAsync();
    }

    private static async Task<BookingResponse> BuildBookingResponseAsync(Client supabase)
    {
        var appointments = await GetModelsAsync<Appointment>(supabase);
        var users = await GetModelsAsync<User>(supabase);
        var therapists = await GetModelsAsync<Therapist>(supabase);
        var services = await GetModelsAsync<TherapyService>(supabase);
        var schedules = await GetModelsAsync<Schedule>(supabase);
        var payments = await GetModelsAsync<Payment>(supabase);
        var reviews = await GetModelsAsync<Review>(supabase);

        var usersById = users.ToDictionary(user => user.Id);
        var therapistsById = therapists.ToDictionary(therapist => therapist.Id);
        var servicesById = services.ToDictionary(service => service.Id);
        var schedulesById = schedules.ToDictionary(schedule => schedule.Id);
        var paymentsByAppointmentId = payments
            .GroupBy(payment => payment.AppointmentId)
            .ToDictionary(group => group.Key, group => group.OrderByDescending(payment => payment.CreatedAt).First());
        var reviewsByAppointmentId = reviews
            .GroupBy(review => review.AppointmentId)
            .ToDictionary(group => group.Key, group => group.OrderByDescending(review => review.CreatedAt).First());

        var bookingRows = appointments
            .OrderByDescending(appointment => appointment.AppointmentDate)
            .ThenBy(appointment => appointment.StartTime)
            .Select(appointment =>
            {
                usersById.TryGetValue(appointment.UserId, out var customer);
                therapistsById.TryGetValue(appointment.TherapistId, out var therapist);
                servicesById.TryGetValue(appointment.ServiceId, out var service);
                schedulesById.TryGetValue(appointment.ScheduleId, out var schedule);
                paymentsByAppointmentId.TryGetValue(appointment.Id, out var payment);
                reviewsByAppointmentId.TryGetValue(appointment.Id, out var review);

                User? therapistUser = null;
                if (therapist is not null)
                {
                    usersById.TryGetValue(therapist.UserId, out therapistUser);
                }

                var customerMeta = ParseCustomerMeta(appointment.AdminNote);
                return new BookingRow(
                    appointment.Id,
                    appointment.AppointmentNo,
                    appointment.Status,
                    GetMetaValue(customerMeta, "Customer") ?? customer?.FullName ?? customer?.Username ?? $"User #{appointment.UserId}",
                    GetMetaValue(customerMeta, "Phone") ?? customer?.Phone,
                    GetMetaValue(customerMeta, "Email") ?? customer?.Email,
                    appointment.TherapistId,
                    therapistUser?.FullName ?? therapist?.TherapistCode ?? $"Therapist #{appointment.TherapistId}",
                    therapist?.TherapistCode,
                    service?.ServiceName ?? $"Service #{appointment.ServiceId}",
                    service?.DurationMinutes,
                    service?.Price,
                    appointment.AppointmentDate,
                    appointment.StartTime,
                    appointment.EndTime,
                    schedule?.IsAvailable,
                    payment?.Amount,
                    payment?.PaymentMethod,
                    payment?.PaymentStatus,
                    payment?.PaidAt,
                    review?.Rating,
                    review?.Comment,
                    appointment.CustomerNote,
                    appointment.AdminNote,
                    appointment.CreatedAt,
                    appointment.UpdatedAt);
            })
            .ToList();

        var summary = new BookingSummary(
            bookingRows.Count,
            bookingRows.Count(row => string.Equals(row.Status, "pending", StringComparison.OrdinalIgnoreCase)),
            bookingRows.Count(row => string.Equals(row.Status, "confirmed", StringComparison.OrdinalIgnoreCase)),
            bookingRows.Count(row => string.Equals(row.Status, "completed", StringComparison.OrdinalIgnoreCase)),
            bookingRows.Sum(row => row.PaymentAmount ?? 0));

        return new BookingResponse(summary, bookingRows);
    }

    private static string? ValidateCreateBookingRequest(CreateBookingRequest request)
    {
        if (request.ServiceId <= 0)
        {
            return "Please choose a service.";
        }

        if (string.IsNullOrWhiteSpace(request.SlotId))
        {
            return "Please choose a booking slot.";
        }

        if (string.IsNullOrWhiteSpace(request.CustomerName))
        {
            return "Customer name is required.";
        }

        if (string.IsNullOrWhiteSpace(request.Phone))
        {
            return "Phone is required.";
        }

        return null;
    }

    private static async Task<List<BookingSlotOption>> BuildBookingSlotsAsync(Client supabase, bool onlyAvailable)
    {
        var therapists = await GetModelsAsync<Therapist>(supabase);
        var users = await GetModelsAsync<User>(supabase);
        var appointments = await GetModelsAsync<Appointment>(supabase);
        var schedules = await GetModelsAsync<Schedule>(supabase);

        var therapist = therapists
            .Where(item => item.IsAvailable)
            .OrderBy(item => item.Id)
            .FirstOrDefault()
            ?? therapists.OrderBy(item => item.Id).FirstOrDefault();

        if (therapist is null)
        {
            return [];
        }

        users.ToDictionary(user => user.Id).TryGetValue(therapist.UserId, out var therapistUser);
        var now = DateTime.Now;
        var bookedSlots = appointments
            .Where(item => !string.Equals(item.Status, "cancelled", StringComparison.OrdinalIgnoreCase))
            .Where(item => item.TherapistId == therapist.Id)
            .Select(item => SlotKey(item.StartTime))
            .ToHashSet(StringComparer.Ordinal);
        var openSlots = schedules
            .Where(item => item.TherapistId == therapist.Id && item.IsAvailable)
            .Select(item => $"{SlotKey(item.StartTime)}-{SlotKey(item.EndTime)}")
            .ToHashSet(StringComparer.Ordinal);

        return GenerateBookingSlotTimes()
            .Where(slot => !onlyAvailable || slot.StartTime >= now)
            .Where(slot => !onlyAvailable || openSlots.Contains($"{SlotKey(slot.StartTime)}-{SlotKey(slot.EndTime)}"))
            .Where(slot => !onlyAvailable || !bookedSlots.Contains(SlotKey(slot.StartTime)))
            .Select(slot => new BookingSlotOption(
                BuildSlotId(therapist.Id, slot.StartTime),
                therapist.Id,
                therapistUser?.FullName ?? therapist.TherapistCode,
                therapist.TherapistCode,
                slot.StartTime,
                slot.EndTime))
            .ToList();
    }

    private static IEnumerable<(DateTime StartTime, DateTime EndTime)> GenerateBookingSlotTimes()
    {
        for (var day = 0; day < 7; day++)
        {
            var date = DateTime.Today.AddDays(day);
            foreach (var slot in GenerateFixedDaySlotTimes(date))
            {
                yield return slot;
            }
        }
    }

    private static IEnumerable<(DateTime StartTime, DateTime EndTime)> GenerateFixedDaySlotTimes(DateTime date)
    {
        yield return (date.Date.AddHours(9), date.Date.AddHours(11));
        yield return (date.Date.AddHours(14), date.Date.AddHours(16));
    }

    private static string BuildSlotId(long therapistId, DateTime startTime)
    {
        return $"{therapistId}:{SlotKey(startTime)}";
    }

    private static string SlotKey(DateTime value)
    {
        return value.ToString("yyyyMMddHHmm");
    }

    private static bool SameMinute(DateTime left, DateTime right)
    {
        return SlotKey(left) == SlotKey(right);
    }

    private static string? ValidateScheduleRequest(ScheduleEditorRequest request)
    {
        if (request.TherapistId <= 0)
        {
            return "Please choose a therapist.";
        }

        if (request.EndTime <= request.StartTime)
        {
            return "End time must be later than start time.";
        }

        return null;
    }

    private static string BuildCustomerMeta(CreateBookingRequest request)
    {
        return $"Customer={request.CustomerName.Trim()};Phone={request.Phone.Trim()};Email={request.Email?.Trim()}";
    }

    private static Dictionary<string, string> ParseCustomerMeta(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return [];
        }

        return value
            .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(part => part.Split('=', 2, StringSplitOptions.TrimEntries))
            .Where(parts => parts.Length == 2 && !string.IsNullOrWhiteSpace(parts[0]))
            .ToDictionary(parts => parts[0], parts => parts[1], StringComparer.OrdinalIgnoreCase);
    }

    private static string? GetMetaValue(Dictionary<string, string> metadata, string key)
    {
        return metadata.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value) ? value : null;
    }

    private static async Task<List<TModel>> GetModelsAsync<TModel>(Client supabase)
        where TModel : BaseModel, new()
    {
        var response = await supabase.From<TModel>().Limit(500).Get();
        return response.Models;
    }
}

public sealed record CreateBookingRequest(
    long ServiceId,
    string SlotId,
    string CustomerName,
    string Phone,
    string? Email,
    string? Note);

public sealed record UpdateBookingStatusRequest(string Status);

public sealed record DayScheduleRequest(
    long TherapistId,
    DateTime Date,
    bool IsBusinessDay);

public sealed record SlotScheduleRequest(
    long TherapistId,
    DateTime StartTime,
    DateTime EndTime,
    bool IsAvailable);

public abstract record ScheduleEditorRequest(
    long TherapistId,
    DateTime StartTime,
    DateTime EndTime,
    bool IsAvailable);

public sealed record CreateScheduleRequest(
    long TherapistId,
    DateTime StartTime,
    DateTime EndTime,
    bool IsAvailable) : ScheduleEditorRequest(TherapistId, StartTime, EndTime, IsAvailable);

public sealed record UpdateScheduleRequest(
    long TherapistId,
    DateTime StartTime,
    DateTime EndTime,
    bool IsAvailable) : ScheduleEditorRequest(TherapistId, StartTime, EndTime, IsAvailable);

public sealed record ServiceOption(
    long Id,
    string ServiceName,
    string? Description,
    int DurationMinutes,
    decimal Price);

public sealed record ScheduleOption(
    long Id,
    long TherapistId,
    string TherapistName,
    string? TherapistCode,
    DateTime StartTime,
    DateTime EndTime);

public sealed record BookingSlotOption(
    string SlotId,
    long TherapistId,
    string TherapistName,
    string? TherapistCode,
    DateTime StartTime,
    DateTime EndTime);

public sealed record PublicBookingRow(
    string AppointmentNo,
    string Status,
    string CustomerName,
    string ServiceName,
    string TherapistName,
    DateTime StartTime,
    DateTime EndTime);

public sealed record TherapistOption(
    long Id,
    string TherapistCode,
    string TherapistName,
    bool IsAvailable);

public sealed record AdminScheduleRow(
    long Id,
    long TherapistId,
    string TherapistCode,
    string TherapistName,
    DateTime StartTime,
    DateTime EndTime,
    bool IsAvailable,
    DateTime CreatedAt);

public sealed record BookingResponse(BookingSummary Summary, IReadOnlyList<BookingRow> Bookings);

public sealed record BookingSummary(
    int Total,
    int Pending,
    int Confirmed,
    int Completed,
    decimal Revenue);

public sealed record BookingRow(
    long Id,
    string AppointmentNo,
    string Status,
    string CustomerName,
    string? CustomerPhone,
    string? CustomerEmail,
    long TherapistId,
    string TherapistName,
    string? TherapistCode,
    string ServiceName,
    int? DurationMinutes,
    decimal? ServicePrice,
    DateTime AppointmentDate,
    DateTime StartTime,
    DateTime EndTime,
    bool? ScheduleIsAvailable,
    decimal? PaymentAmount,
    string? PaymentMethod,
    string? PaymentStatus,
    DateTime? PaidAt,
    int? Rating,
    string? ReviewComment,
    string? CustomerNote,
    string? AdminNote,
    DateTime CreatedAt,
    DateTime UpdatedAt);
