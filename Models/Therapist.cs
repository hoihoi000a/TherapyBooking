using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace TherapyPreservation.Models;

[Table("therapists")]
public class Therapist : BaseModel
{
    [PrimaryKey("id", false)]
    public long Id { get; set; }

    [Column("user_id")]
    public long UserId { get; set; }

    [Column("therapist_code")]
    public string TherapistCode { get; set; } = string.Empty;

    [Column("introduction")]
    public string? Introduction { get; set; }

    [Column("experience_years")]
    public int ExperienceYears { get; set; }

    [Column("is_available")]
    public bool IsAvailable { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    public override string ToString()
    {
        return $"{Id} | user={UserId} | {TherapistCode} | years={ExperienceYears} | available={IsAvailable}";
    }
}
