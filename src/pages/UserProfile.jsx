
import { useState, useEffect } from "react";
import { User } from "@/api/entities.jsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function UserProfile() {
  const [formData, setFormData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isViewingAsAdmin, setIsViewingAsAdmin] = useState(false);
  const navigate = useNavigate();

  // Check if admin is viewing another user's profile
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const me = await User.me();
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('userId');
        
        // Allow admins to view other user profiles, but redirect to dashboard if viewing their own profile
        if (me.role === "admin" && !userId && me.user_type !== 'user') {
          navigate(createPageUrl("AdminDashboard"));
        }
      } catch (error) {
        // User not authenticated - redirect to landing
        console.error("Failed to check user role:", error);
        navigate(createPageUrl("Landing"));
      }
    };
    checkAdminStatus();
  }, [navigate]);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      // Get current logged-in user
      const loggedInUser = await User.me();
      setCurrentUser(loggedInUser);
      
      // Check if admin is viewing another user's profile
      const urlParams = new URLSearchParams(window.location.search);
      const userId = urlParams.get('userId');
      
      let userToLoad = loggedInUser;
      
      if (userId && loggedInUser.role === 'admin') {
        // Admin viewing another user's profile
        setIsViewingAsAdmin(true);
        const targetUser = await User.get(userId);
        userToLoad = targetUser;
      }
      
      setFormData({
        id: userToLoad.id,
        full_name: userToLoad.full_name || '',
        phone: userToLoad.phone || '',
        location: { address: userToLoad.location?.address || '' },
        bio: userToLoad.bio || '',
        preferred_coaching_types: userToLoad.preferred_coaching_types || [],
        preferred_session_times: userToLoad.preferred_session_times || [],
      });
    } catch (error) {
      console.error("Failed to load user", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    if (field === 'location.address') {
      setFormData(prev => ({ ...prev, location: { ...prev.location, address: value } }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };
  
  const handleArrayChange = (field, value, checked) => {
    setFormData(prev => {
      const currentArray = prev[field] || [];
      if (checked) {
        return { ...prev, [field]: [...currentArray, value] };
      } else {
        return { ...prev, [field]: currentArray.filter(item => item !== value) };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await User.updateMyUserData(formData);
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Failed to update profile", error);
      alert("Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const coachingTypes = [
    { value: 'striker', label: 'Striker & Finishing' },
    { value: 'midfield', label: 'Midfield & Playmaking' },
    { value: 'defense', label: 'Defense & Tackling' },
    { value: 'goalkeeping', label: 'Goalkeeping' },
    { value: 'fitness_conditioning', label: 'Fitness & Conditioning' },
    { value: 'tactical_analysis', label: 'Tactical Analysis' }
  ];

  const sessionTimes = [
    { value: 'morning', label: 'Morning (6AM - 12PM)' },
    { value: 'afternoon', label: 'Afternoon (12PM - 6PM)' },
    { value: 'evening', label: 'Evening (6PM - 10PM)' },
    { value: 'weekend', label: 'Weekends' }
  ];

  if (isLoading || !formData) return <div>Loading...</div>;

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">My Profile</h1>
          <p className="text-slate-600">Update your personal information and preferences.</p>
        </motion.div>

        <Card>
          <CardHeader><CardTitle>Edit Profile</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input id="full_name" value={formData.full_name} onChange={(e) => handleInputChange('full_name', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" type="tel" value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Your Location</Label>
                <Input id="location" value={formData.location.address} onChange={(e) => handleInputChange('location.address', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">About You</Label>
                <Textarea id="bio" value={formData.bio} onChange={(e) => handleInputChange('bio', e.target.value)} rows={4} />
              </div>

              <div className="space-y-3">
                <Label>I want to improve my...</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {coachingTypes.map((type) => (
                    <div key={type.value} className="flex items-center space-x-2">
                      <Checkbox id={`pref-${type.value}`} checked={formData.preferred_coaching_types.includes(type.value)} onCheckedChange={(checked) => handleArrayChange('preferred_coaching_types', type.value, checked)} />
                      <Label htmlFor={`pref-${type.value}`} className="text-sm font-normal">{type.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Preferred Session Times</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sessionTimes.map((time) => (
                    <div key={time.value} className="flex items-center space-x-2">
                      <Checkbox id={`time-${time.value}`} checked={formData.preferred_session_times.includes(time.value)} onCheckedChange={(checked) => handleArrayChange('preferred_session_times', time.value, checked)} />
                      <Label htmlFor={`time-${time.value}`} className="text-sm">{time.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
