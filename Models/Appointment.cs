using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace TherapyPreservation.Models;

[Table("appointments")]
public class Appointment : BaseModel
{
    [PrimaryKey("id", false)]
    public long Id { get; set; }

    [Column("appointment_no")]
    public string AppointmentNo { get; set; } = string.Empty;

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("therapist_id")]
    public long TherapistId { get; set; }

    [Column("service_id")]
    public long ServiceId { get; set; }

    [Column("schedule_id")]
    public long ScheduleId { get; set; }

    [Column("appointment_date")]
    public DateTime AppointmentDate { get; set; }

    [Column("start_time")]
    public DateTime StartTime { get; set; }

    [Column("end_time")]
    public DateTime EndTime { get; set; }

    [Column("status")]
    public string Status { get; set; } = string.Empty;

    [Column("customer_note")]
    public string? CustomerNote { get; set; }

    [Column("admin_note")]
    public string? AdminNote { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }

    public override string ToString()
    {
        return $"{Id} | {AppointmentNo} | user={UserId} | therapist={TherapistId} | service={ServiceId} | {Status}";
    }
}
