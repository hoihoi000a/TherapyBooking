using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace TherapyPreservation.Models;

[Table("roles")]
public class Role : BaseModel
{
    [PrimaryKey("id", false)]
    public long Id { get; set; }

    [Column("role_name")]
    public string RoleName { get; set; } = string.Empty;

    public override string ToString()
    {
        return $"{Id} | {RoleName}";
    }
}
