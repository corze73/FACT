import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@/api/entities.jsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";

// This component is very similar to UserProfile, but includes coach-specific fields.
// In a larger app, this could be refactored to reduce duplication.

export default function CoachProfile() {
  // eslint-disable-next-line no-unused-vars
  const navigate = useNavigate();
  const [formData, setFormData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [currentUser, setCurrentUser] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [isViewingAsAdmin, setIsViewingAsAdmin] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      // Get current logged-in user
      const loggedInUser = await User.me();
      setCurrentUser(loggedInUser);
      console.log('Logged in user:', loggedInUser.full_name, 'Role:', loggedInUser.role);

      // Check if viewing another user's profile (admin viewing someone else)
      const urlParams = new URLSearchParams(window.location.search);
      const userIdParam = urlParams.get('userId');
      console.log('userId parameter:', userIdParam);
      
      let userToLoad;
      if (userIdParam && loggedInUser.role === 'admin') {
        // Admin viewing another user's profile
        console.log('Admin viewing another coach profile, loading user:', userIdParam);
        setIsViewingAsAdmin(true);
        userToLoad = await User.get(userIdParam);
        console.log('Loaded coach:', userToLoad.full_name);
      } else {
        // User viewing their own profile
        console.log('User viewing own profile');
        userToLoad = loggedInUser;
      }
      
      setFormData({
        id: userToLoad.id,
        full_name: userToLoad.full_name || '',
        phone: userToLoad.phone || '',
        location: { address: userToLoad.location?.address || '' },
        bio: userToLoad.bio || '',
        coach_profile: {
          hourly_rate: userToLoad.coach_profile?.hourly_rate || 50,
          services_offered: userToLoad.coach_profile?.services_offered || [],
          age_groups: userToLoad.coach_profile?.age_groups || [],
        },
      });
    } catch (error) {
      console.error("Failed to load user", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    if (field.startsWith('coach_profile.')) {
      const subField = field.replace('coach_profile.', '');
       setFormData(prev => ({ ...prev, coach_profile: { ...prev.coach_profile, [subField]: value }}));
    } else if (field === 'location.address') {
      setFormData(prev => ({ ...prev, location: { ...prev.location, address: value } }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };
  
  const handleServicesChange = (value, checked) => {
    setFormData(prev => {
      const currentServices = prev.coach_profile?.services_offered || [];
      const newServices = checked ? [...currentServices, value] : currentServices.filter(s => s !== value);
      return { ...prev, coach_profile: { ...prev.coach_profile, services_offered: newServices }};
    });
  };

  const handleAgeGroupsChange = (value, checked) => {
    setFormData(prev => {
      const currentAgeGroups = prev.coach_profile?.age_groups || [];
      const newAgeGroups = checked ? [...currentAgeGroups, value] : currentAgeGroups.filter(s => s !== value);
      return { ...prev, coach_profile: { ...prev.coach_profile, age_groups: newAgeGroups }};
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

  const ageGroups = [
    { value: 'under_8', label: 'Under 8s' },
    { value: 'under_10', label: 'Under 10s' },
    { value: 'under_12', label: 'Under 12s' },
    { value: 'under_14', label: 'Under 14s' },
    { value: 'under_16', label: 'Under 16s' },
    { value: 'under_18', label: 'Under 18s' },
    { value: 'adults', label: 'Adults (18+)' },
    { value: 'seniors', label: 'Seniors (35+)' }
  ];

  if (isLoading || !formData) return <div>Loading...</div>;

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">My Coach Profile</h1>
          <p className="text-slate-600">Update your public profile and coaching details.</p>
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
                <Label htmlFor="bio">About You (Public Bio)</Label>
                <Textarea id="bio" value={formData.bio} onChange={(e) => handleInputChange('bio', e.target.value)} rows={4} />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="hourly_rate">Hourly Rate (£)</Label>
                <Input id="hourly_rate" type="number" value={formData.coach_profile.hourly_rate} onChange={(e) => handleInputChange('coach_profile.hourly_rate', parseInt(e.target.value))} />
              </div>

              <div className="space-y-3">
                <Label>Services You Offer</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {coachingTypes.map((type) => (
                    <div key={type.value} className="flex items-center space-x-2">
                      <Checkbox id={`service-${type.value}`} checked={formData.coach_profile.services_offered.includes(type.value)} onCheckedChange={(checked) => handleServicesChange(type.value, checked)} />
                      <Label htmlFor={`service-${type.value}`} className="text-sm font-normal">{type.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Age Groups You Coach</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {ageGroups.map((age) => (
                    <div key={age.value} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`age-${age.value}`} 
                        checked={formData.coach_profile.age_groups?.includes(age.value)} 
                        onCheckedChange={(checked) => handleAgeGroupsChange(age.value, checked)} 
                      />
                      <Label htmlFor={`age-${age.value}`} className="text-sm font-normal">{age.label}</Label>
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