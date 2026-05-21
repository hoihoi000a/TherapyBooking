using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace TherapyPreservation.Models;

[Table("therapy_services")]
public class TherapyService : BaseModel
{
    [PrimaryKey("id", false)]
    public long Id { get; set; }

    [Column("service_name")]
    public string ServiceName { get; set; } = string.Empty;

    [Column("description")]
    public string? Description { get; set; }

    [Column("duration_minutes")]
    public int DurationMinutes { get; set; }

    [Column("price")]
    public decimal Price { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    public override string ToString()
    {
        return $"{Id} | {ServiceName} | {DurationMinutes} min | {Price} | active={IsActive}";
    }
}
