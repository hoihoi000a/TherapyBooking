using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace TherapyPreservation.Models;

[Table("users")]
public class User : BaseModel
{
    [PrimaryKey("id", false)]
    public long Id { get; set; }

    [Column("role_id")]
    public long RoleId { get; set; }

    [Column("username")]
    public string Username { get; set; } = string.Empty;

    [Column("password_hash")]
    public string PasswordHash { get; set; } = string.Empty;

    [Column("full_name")]
    public string FullName { get; set; } = string.Empty;

    [Column("gender")]
    public string? Gender { get; set; }

    [Column("birthday")]
    public DateTime? Birthday { get; set; }

    [Column("phone")]
    public string? Phone { get; set; }

    [Column("email")]
    public string Email { get; set; } = string.Empty;

    [Column("address")]
    public string? Address { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }

    public override string ToString()
    {
        return $"{Id} | {Username} | {FullName} | role={RoleId} | active={IsActive}";
    }
}
