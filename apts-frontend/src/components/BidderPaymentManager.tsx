import { useEffect, useState } from "react";
import api from "@/services/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";

interface PaymentHistory {
  id: string;
  paid_at: string;
  amount: number;
  application_count: number;
}

interface Payment {
  bidder_id: string;
  username: string;
  rate: number;
  application_count: number;
  last_paid_at: string | null;
  payment_history: PaymentHistory[];
}

export default function BidderPaymentManager() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBidder, setEditingBidder] = useState<Payment | null>(null);
  const [manualDate, setManualDate] = useState<Date | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchPayments = async () => {
    try {
      const res = await api.get("/developer/payments");
      setPayments(
        res.data.sort((a: Payment, b: Payment) =>
          a.username.localeCompare(b.username)
        )
      );
    } catch {
      toast.error("Failed to fetch payments");
    } finally {
      setLoading(false);
    }
  };

  const openManualDateEditor = (payment: Payment) => {
    setEditingBidder(payment);
    setManualDate(payment.last_paid_at ? new Date(payment.last_paid_at) : null);
    setModalOpen(true);
  };

  const saveManualDate = async () => {
    if (!editingBidder) return;

    try {
      await api.patch(
        `/developer/payments/${editingBidder.bidder_id}/last-paid-at`,
        {
          last_paid_at: manualDate ? manualDate.toISOString() : null,
        }
      );

      toast.success("Last paid date updated!");
      setModalOpen(false);
      fetchPayments();
    } catch {
      toast.error("Failed to update");
    }
  };

  const markAsPaid = async (bidderId: string) => {
    try {
      await api.post(`/developer/pay-bidder/${bidderId}`);
      toast.success("Marked as paid.");
      fetchPayments();
    } catch {
      toast.error("Payment update failed.");
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    const confirm = window.confirm("Delete this payment record?");
    if (!confirm) return;
    try {
      await api.delete(`/developer/payment-history/${paymentId}`);
      toast.success("Payment record deleted.");
      fetchPayments(); // Refresh
    } catch {
      toast.error("Failed to delete.");
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Bidder Payment Management</h2>

      {loading && <p>Loading...</p>}

      {!loading &&
        payments.map((p) => (
          <div
            key={p.bidder_id}
            className="border p-4 rounded space-y-2 bg-white shadow-sm"
          >
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">{p.username}</h3>
                <p className="text-sm">Rate: ${p.rate}</p>
                <p className="text-sm">
                  Applications since last paid: {p.application_count}
                </p>
                <p className="text-sm font-medium">
                  Due: ${p.application_count * p.rate}
                </p>
                <p className="text-sm">
                  Last Paid At:{" "}
                  {p.last_paid_at
                    ? format(new Date(p.last_paid_at), "yyyy-MM-dd")
                    : "Never Paid"}
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openManualDateEditor(p)}
                  disabled
                >
                  Set Paid Date
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => markAsPaid(p.bidder_id)}
                >
                  Mark as Paid
                </Button>
              </div>
            </div>

            {p.payment_history.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold text-sm mb-2">Payment History</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Application Count</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p.payment_history.map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          {format(new Date(entry.paid_at), "yyyy-MM-dd")}
                        </TableCell>
                        <TableCell>${entry.amount.toFixed(2)}</TableCell>
                        <TableCell>{entry.application_count}</TableCell>
                        <TableCell className="text-right">
                          {idx === 0 && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeletePayment(entry.id)}
                            >
                              Delete
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        ))}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Last Paid Date</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Label>Date</Label>
            <DatePicker
              selected={manualDate}
              onChange={(date) => setManualDate(date)}
              dateFormat="yyyy-MM-dd"
              placeholderText="Select date"
              className="border px-2 py-1 rounded w-full"
              isClearable
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveManualDate}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
