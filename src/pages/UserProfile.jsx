
import { useState, useEffect, useRef } from "react";
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
import { Upload } from "lucide-react";

export default function UserProfile() {
  const [formData, setFormData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [currentUser, setCurrentUser] = useState(null);
  const [isViewingAsAdmin, setIsViewingAsAdmin] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Check if admin is viewing another user's profile
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const me = await User.me();
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('userId');
        
        // Only redirect admin to dashboard if they're trying to view their own profile without userId
        // Allow admin to view other users when userId is present
        if (me.role === "admin" && !userId) {
          // Admin trying to view their own user profile - redirect to dashboard
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
      console.log('Logged in user:', loggedInUser.full_name, 'Role:', loggedInUser.role);
      
      // Check if admin is viewing another user's profile
      const urlParams = new URLSearchParams(window.location.search);
      const userId = urlParams.get('userId');
      console.log('userId parameter:', userId);
      
      let userToLoad = loggedInUser;
      
      if (userId && loggedInUser.role === 'admin') {
        // Admin viewing another user's profile
        console.log('Admin viewing another user profile, loading user:', userId);
        setIsViewingAsAdmin(true);
        const targetUser = await User.get(userId);
        userToLoad = targetUser;
        console.log('Loaded user:', userToLoad.full_name);
      } else {
        console.log('User viewing own profile');
      }
      
      setFormData({
        id: userToLoad.id,
        full_name: userToLoad.full_name || '',
        phone: userToLoad.phone || '',
        location: { address: userToLoad.location?.address || '' },
        bio: userToLoad.bio || '',
        avatar_url: userToLoad.avatar_url || '',
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

  const handleProfilePictureUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be smaller than 5MB');
      return;
    }
    
    setUploadingImage(true);
    
    // Create a compressed image
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas to resize image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set max dimensions
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;
        
        // Calculate new dimensions
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to base64 with reduced quality
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setFormData(prev => ({ ...prev, avatar_url: compressedBase64 }));
        setUploadingImage(false);
      };
      img.onerror = () => {
        alert('Failed to load image');
        setUploadingImage(false);
      };
      img.src = event.target.result;
    };
    reader.onerror = () => {
      alert('Failed to read file');
      setUploadingImage(false);
    };
    reader.readAsDataURL(file);
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
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {isViewingAsAdmin ? 'User Profile' : 'My Profile'}
          </h1>
          <p className="text-slate-600">
            {isViewingAsAdmin ? 'Viewing user information and preferences.' : 'Update your personal information and preferences.'}
          </p>
        </motion.div>

        <Card>
          <CardHeader><CardTitle>{isViewingAsAdmin ? 'View Profile' : 'Edit Profile'}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Left Column - Form Fields */}
                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full Name</Label>
                      <Input id="full_name" value={formData.full_name} onChange={(e) => handleInputChange('full_name', e.target.value)} disabled={isViewingAsAdmin} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" type="tel" value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} disabled={isViewingAsAdmin} />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="location">Your Location</Label>
                    <Input id="location" value={formData.location.address} onChange={(e) => handleInputChange('location.address', e.target.value)} disabled={isViewingAsAdmin} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="bio">About You</Label>
                    <Textarea id="bio" value={formData.bio} onChange={(e) => handleInputChange('bio', e.target.value)} rows={4} disabled={isViewingAsAdmin} />
                  </div>

                  <div className="space-y-3">
                    <Label>I want to improve my...</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {coachingTypes.map((type) => (
                        <div key={type.value} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`pref-${type.value}`} 
                            checked={formData.preferred_coaching_types.includes(type.value)} 
                            onCheckedChange={(checked) => handleArrayChange('preferred_coaching_types', type.value, checked)}
                            disabled={isViewingAsAdmin}
                          />
                          <Label htmlFor={`pref-${type.value}`} className="text-sm font-normal cursor-pointer">{type.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Preferred Session Times</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {sessionTimes.map((time) => (
                        <div key={time.value} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`time-${time.value}`} 
                            checked={formData.preferred_session_times.includes(time.value)} 
                            onCheckedChange={(checked) => handleArrayChange('preferred_session_times', time.value, checked)}
                            disabled={isViewingAsAdmin}
                          />
                          <Label htmlFor={`time-${time.value}`} className="text-sm cursor-pointer">{time.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {!isViewingAsAdmin && (
                    <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  )}
                </div>

                {/* Right Column - Profile Picture */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label>Profile Picture</Label>
                    <div className="relative">
                      {formData.avatar_url ? (
                        <div className="relative w-full aspect-square max-w-md mx-auto rounded-lg overflow-hidden border-2 border-slate-200">
                          <img 
                            src={formData.avatar_url} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                          />
                          {!isViewingAsAdmin && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="absolute bottom-4 right-4"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              Change Photo
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div 
                          className={`w-full aspect-square max-w-md mx-auto rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center ${!isViewingAsAdmin ? 'cursor-pointer hover:border-blue-400 hover:bg-blue-50' : ''} transition-colors`}
                          onClick={() => !isViewingAsAdmin && fileInputRef.current?.click()}
                        >
                          <Upload className="w-12 h-12 text-slate-400 mb-2" />
                          <p className="text-sm text-slate-600 font-medium">
                            {isViewingAsAdmin ? 'No Profile Picture' : 'Upload Profile Picture'}
                          </p>
                          {!isViewingAsAdmin && (
                            <p className="text-xs text-slate-400 mt-1">Click to browse (Max 5MB)</p>
                          )}
                        </div>
                      )}
                      {!isViewingAsAdmin && (
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleProfilePictureUpload}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
