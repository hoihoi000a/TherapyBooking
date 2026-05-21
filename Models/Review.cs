using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace TherapyPreservation.Models;

[Table("reviews")]
public class Review : BaseModel
{
    [PrimaryKey("id", false)]
    public long Id { get; set; }

    [Column("appointment_id")]
    public long AppointmentId { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("therapist_id")]
    public long TherapistId { get; set; }

    [Column("rating")]
    public int Rating { get; set; }

    [Column("comment")]
    public string? Comment { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    public override string ToString()
    {
        return $"{Id} | appointment={AppointmentId} | therapist={TherapistId} | rating={Rating}";
    }
}
