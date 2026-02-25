import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';

const Kirish = () => {
  const [username, setKirish] = useState('');
  const [password, setParol] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      toast.success('Kirish muvaffaqiyatli!');
      navigate('/');
    } catch (error) {
      toast.error('Kirish yoki parol noto‘g‘ri');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl border border-slate-100 shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#1e1b4b] rounded-full flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Dangara Hotel</h1>
            <p className="text-slate-600">Admin panel</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="username">Kirish</Label>
              <Input
                id="username"
                data-testid="username-input"
                type="text"
                value={username}
                onChange={(e) => setKirish(e.target.value)}
                required
                placeholder="Kirishni kiriting"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="password">Parol</Label>
              <Input
                id="password"
                data-testid="password-input"
                type="password"
                value={password}
                onChange={(e) => setParol(e.target.value)}
                required
                placeholder="Parolni kiriting"
                className="mt-2"
              />
            </div>

            <Button
              data-testid="login-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-[#1e1b4b] hover:bg-[#312e81] text-white"
            >
              {loading ? 'Kirilmoqda...' : 'Kirish'}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-slate-50 rounded-lg">
            <p className="text-xs font-medium text-slate-700 mb-2">Demo ma'lumotlar:</p>
            <div className="text-xs text-slate-600 space-y-1">
              <p><strong>Admin:</strong> admin / admin123</p>
              <p><strong>Resepsion:</strong> reception / reception123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Kirish;