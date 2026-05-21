using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace TherapyPreservation.Models;

[Table("schedules")]
public class Schedule : BaseModel
{
    [PrimaryKey("id", false)]
    public long Id { get; set; }

    [Column("therapist_id")]
    public long TherapistId { get; set; }

    [Column("start_time")]
    public DateTime StartTime { get; set; }

    [Column("end_time")]
    public DateTime EndTime { get; set; }

    [Column("is_available")]
    public bool IsAvailable { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    public override string ToString()
    {
        return $"{Id} | therapist={TherapistId} | {StartTime:yyyy-MM-dd HH:mm} - {EndTime:HH:mm} | available={IsAvailable}";
    }
}
