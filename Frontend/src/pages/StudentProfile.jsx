import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE_URL, fetchJsonCached, invalidateApiCache, resolveFileUrl } from "@/lib/api";

export default function StudentProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    department: "",
    avatarUrl: "",
    bio: "",
    email: "",
    username: ""
  });

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      toast.error("Not authenticated");
      return;
    }
    setLoading(true);
    fetchJsonCached(`${API_BASE_URL}/api/users/me`, {
      token,
      ttlMs: 180000,
      cacheKey: "users:me",
    })
      .then((data) => {
        if (data) {
          setForm({
            fullName: data.fullName || "",
            phone: data.phone || "",
            department: data.department || "",
            avatarUrl: data.avatarUrl || "",
            bio: data.bio || "",
            email: data.email || "",
            username: data.username || ""
          });
        }
      })
      .catch((error) => {
        toast.error(error?.message || "Failed to load profile");
      })
      .finally(() => setLoading(false));
  }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSave = async () => {
    const token = localStorage.getItem("userToken");
    if (!token) return toast.error("Not authenticated");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          fullName: form.fullName,
          phone: form.phone,
          department: form.department,
          avatarUrl: form.avatarUrl,
          bio: form.bio
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Update failed");
      // Update greeting cache
      if (form.fullName) {
        localStorage.setItem("userName", form.fullName);
      }
      if (form.avatarUrl) {
        localStorage.setItem("userAvatarUrl", form.avatarUrl);
      } else {
        localStorage.removeItem("userAvatarUrl");
      }
      invalidateApiCache((key) => String(key).includes("users:me"));
      window.dispatchEvent(
        new CustomEvent("profile:avatar-updated", { detail: { avatarUrl: form.avatarUrl || "" } })
      );
      toast.success("Profile updated");
      navigate("/student");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  const avatarSrc = form.avatarUrl ? resolveFileUrl(form.avatarUrl) : "";
  const fallbackInitial =
    (form.fullName || form.username || localStorage.getItem("userName") || "U")
      .trim()
      .charAt(0)
      .toUpperCase() || "U";

  return (
    <AppLayout role="student">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-display font-bold">Edit Profile</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 flex items-center gap-4">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover border"
              />
            ) : (
              <div className="w-24 h-24 rounded-full border bg-muted flex items-center justify-center text-3xl font-semibold text-muted-foreground">
                {fallbackInitial}
              </div>
            )}
            <div>
              <Label className="text-sm text-muted-foreground">Profile Image</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const token = localStorage.getItem("userToken");
                  if (!token) return toast.error("Not authenticated");
                  const fd = new FormData();
                  fd.append("file", file);
                  try {
                    const res = await fetch(`${API_BASE_URL}/api/users/me/avatar`, {
                      method: "POST",
                      headers: { Authorization: `Bearer ${token}` },
                      body: fd
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data.message || "Upload failed");
                    if (data.message) {
                      const avatarUrl = data.message;
                      setForm((prev) => ({ ...prev, avatarUrl }));
                      localStorage.setItem("userAvatarUrl", avatarUrl);
                      invalidateApiCache((key) => String(key).includes("users:me"));
                      window.dispatchEvent(
                        new CustomEvent("profile:avatar-updated", { detail: { avatarUrl } })
                      );
                      toast.success("Profile image uploaded");
                    }
                  } catch (err) {
                    toast.error(err.message);
                  }
                }}
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Full Name</label>
            <Input name="fullName" value={form.fullName} onChange={onChange} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Phone</label>
            <Input name="phone" value={form.phone} onChange={onChange} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Department</label>
            <Input name="department" value={form.department} onChange={onChange} />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-muted-foreground">Bio</label>
            <Input name="bio" value={form.bio} onChange={onChange} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Email (read-only)</label>
            <Input value={form.email} readOnly />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Username (read-only)</label>
            <Input value={form.username} readOnly />
          </div>
        </div>
        <Button disabled={loading} onClick={onSave}>Save Changes</Button>
      </div>
    </AppLayout>
  );
}
