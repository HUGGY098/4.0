import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { LogIn, Loader2 } from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import GoogleIcon from "../components/GoogleIcon";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) setError(error.message);
    else if (!data.session) setError("No session created.");
    else navigate("/");

    setLoading(false);
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        scopes: "https://www.googleapis.com/auth/calendar.readonly",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) setError(error.message);
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Log in to your account"
      footer={<>Don't have an account? <Link to="/register">Create one</Link></>}
    >
      <Button variant="outline" className="w-full h-12 mb-6" onClick={google}>
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google
      </Button>

      {error && <div className="mb-4 p-3 text-sm">{error}</div>}

      <form onSubmit={login} className="space-y-4">
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>

        <div>
          <Label>Password</Label>
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>

        <Link to="/forgot-password" className="text-xs">Forgot password?</Link>

        <Button type="submit" className="w-full h-12" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : "Log in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
