import { MessageSquare, Phone, Mail } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";

// Admin contact info (static)
const ADMIN_PHONE = "+1 (555) 123-4567";
const ADMIN_EMAIL = "admin@example.edu";

export default function ContactUs() {
  return (
    <AppLayout role="student">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Contact Us
          </h1>
          <p className="text-muted-foreground mt-1">
            Have questions or need help? Contact the admin team directly.
          </p>
        </div>
        {/* Contact Information */}
        <div className="card-static p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Admin Contact Information</h2>
              <p className="text-sm text-muted-foreground">
                You can contact the admin team using the details below.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="p-3 rounded-lg bg-muted/30 border border-border flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center">
                <Phone className="w-4 h-4 text-info" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium text-foreground">{ADMIN_PHONE}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Recommended for urgent issues or time-sensitive questions.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/30 border border-border flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Mail className="w-4 h-4 text-secondary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium text-foreground break-all">{ADMIN_EMAIL}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  For general questions or feedback, please include your student ID in the email.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Preview */}
        <div className="card-static p-6">
          <h3 className="font-semibold text-foreground mb-4">Frequently Asked Questions</h3>
          <div className="space-y-3">
            {[
              { q: "How do I join a team?", a: "Go to the Competitions page, select a competition, and click 'Join Existing Team'" },
              { q: "Can I leave a team after joining?", a: "Yes, go to My Teams and click the 'Leave Team' button" },
              { q: "How do I submit for external competitions?", a: "Once admin enables submissions, go to Submissions → External tab" },
            ].map((faq, index) => (
              <div key={index} className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="font-medium text-sm text-foreground">{faq.q}</p>
                <p className="text-sm text-muted-foreground mt-1">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
