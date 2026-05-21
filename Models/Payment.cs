using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace TherapyPreservation.Models;

[Table("payments")]
public class Payment : BaseModel
{
    [PrimaryKey("id", false)]
    public long Id { get; set; }

    [Column("appointment_id")]
    public long AppointmentId { get; set; }

    [Column("amount")]
    public decimal Amount { get; set; }

    [Column("payment_method")]
    public string PaymentMethod { get; set; } = string.Empty;

    [Column("payment_status")]
    public string PaymentStatus { get; set; } = string.Empty;

    [Column("paid_at")]
    public DateTime? PaidAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    public override string ToString()
    {
        return $"{Id} | appointment={AppointmentId} | {Amount} | {PaymentMethod} | {PaymentStatus}";
    }
}
