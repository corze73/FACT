import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@/api/entities.jsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";
import { Upload, Video, X, Link as LinkIcon } from "lucide-react";
import AvailabilityCalendar from "@/components/coaches/AvailabilityCalendar";
import { validateAndSanitize, profileUpdateSchema, coachProfileSchema, formatValidationErrors } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rateLimiter";

// This component is very similar to UserProfile, but includes coach-specific fields.
// In a larger app, this could be refactored to reduce duplication.

export default function CoachProfile() {
  // eslint-disable-next-line no-unused-vars
  const navigate = useNavigate();
  const [formData, setFormData] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [currentUser, setCurrentUser] = useState(null);
  const [isViewingAsAdmin, setIsViewingAsAdmin] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [uploadingImage, setUploadingImage] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      // Get current logged-in user
      const loggedInUser = await User.me();
      setCurrentUser(loggedInUser);
      console.log('Logged in user:', loggedInUser.full_name, 'Role:', loggedInUser.role);

      // Check if viewing another user's profile
      const urlParams = new URLSearchParams(window.location.search);
      const userIdParam = urlParams.get('userId');
      console.log('userId parameter:', userIdParam);
      
      let userToLoad;
      if (userIdParam && userIdParam !== loggedInUser.id) {
        // Viewing another coach's profile (could be admin or regular user)
        console.log('Viewing another coach profile, loading user:', userIdParam);
        setIsViewingAsAdmin(true); // Use this flag for "read-only" mode
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
        avatar_url: userToLoad.avatar_url || '',
        video_clip_1: userToLoad.video_clip_1 || '',
        video_clip_2: userToLoad.video_clip_2 || '',
        video_clip_3: userToLoad.video_clip_3 || '',
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

  const setVideoUrl = (clipNumber, value) => {
    // Only allow http/https URLs and allowed hosts (YouTube/Vimeo)
    if (value && !/^https?:\/\//i.test(value)) {
      alert('Please enter a valid URL starting with http:// or https://');
      return;
    }
    if (value) {
      try {
        const u = new URL(value);
        const allowed = ['www.youtube.com','youtube.com','youtu.be','vimeo.com','player.vimeo.com'];
        if (!allowed.includes(u.hostname)) {
          alert('Only YouTube or Vimeo URLs are allowed.');
          return;
        }
      } catch {
        // ignore parse error; handled by http/https check already
      }
    }
    setFormData(prev => ({ ...prev, [`video_clip_${clipNumber}`]: value }));
  };

  const renderEmbed = (url) => {
    if (!url) return null;
    try {
      const u = new URL(url);
      // YouTube patterns
      if (u.hostname === 'youtu.be') {
        const id = u.pathname.replace('/', '');
        return <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${id}`} title="YouTube video" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />;
      }
      if (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') {
        const v = u.searchParams.get('v');
        if (v) {
          return <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${v}`} title="YouTube video" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />;
        }
      }
      // Vimeo patterns
      if (u.hostname === 'vimeo.com') {
        const id = u.pathname.split('/').filter(Boolean)[0];
        if (id) {
          return <iframe className="w-full h-full" src={`https://player.vimeo.com/video/${id}`} title="Vimeo video" frameBorder="0" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />;
        }
      }
      if (u.hostname === 'player.vimeo.com') {
        return <iframe className="w-full h-full" src={url} title="Vimeo video" frameBorder="0" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />;
      }
    } catch {}
    // Fallback link (though not expected due to allowlist)
    return <a href={url} target="_blank" rel="noreferrer" className="block w-full h-full text-center text-slate-200 flex items-center justify-center">Open video</a>;
  };

  const removeVideo = (clipNumber) => {
    setFormData(prev => ({ ...prev, [`video_clip_${clipNumber}`]: '' }));
    if (videoInputRefs[clipNumber].current) {
      videoInputRefs[clipNumber].current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clear previous validation errors
    setValidationErrors({});
    
    try {
      // Check rate limit
      checkRateLimit('profile');
      
      // Validate basic profile fields
      const profileData = {
        full_name: formData.full_name,
        phone: formData.phone || undefined,
        location: formData.location?.address || undefined,
        bio: formData.bio || undefined,
        avatar_url: formData.avatar_url || undefined,
      };
      const validatedProfile = validateAndSanitize(profileUpdateSchema, profileData);
      
      // Validate coach-specific fields
      const coachData = {
        hourly_rate: formData.coach_profile?.hourly_rate || 50,
        services_offered: formData.coach_profile?.services_offered || [],
        age_groups: formData.coach_profile?.age_groups || [],
      };
      const validatedCoach = validateAndSanitize(coachProfileSchema, coachData);
      
      // Merge validated data
      const dataToSave = {
        ...formData,
        ...validatedProfile,
        location: { address: validatedProfile.location || '' },
        coach_profile: validatedCoach,
      };
      
      setIsSaving(true);
      await User.updateMyUserData(dataToSave);
      alert("Profile updated successfully! ✅");
      
    } catch (error) {
      console.error("Failed to update profile", error);
      
      if (error.name === 'ZodError') {
        const errors = formatValidationErrors(error);
        setValidationErrors(errors);
        alert("Please check your input and try again.");
      } else if (error.message && error.message.includes('rate limit')) {
        alert("⚠️ " + error.message);
      } else {
        alert("Failed to update profile. Please try again.");
      }
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
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {isViewingAsAdmin ? 'Coach Profile' : 'My Coach Profile'}
          </h1>
          <p className="text-slate-600">
            {isViewingAsAdmin ? 'Viewing coach profile and coaching details.' : 'Update your public profile and coaching details.'}
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
                      <Input 
                        id="full_name" 
                        value={formData.full_name} 
                        onChange={(e) => handleInputChange('full_name', e.target.value)} 
                        disabled={isViewingAsAdmin}
                        className={validationErrors.full_name ? 'border-red-500' : ''}
                      />
                      {validationErrors.full_name && (
                        <p className="text-sm text-red-500">{validationErrors.full_name}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input 
                        id="phone" 
                        type="tel" 
                        value={formData.phone} 
                        onChange={(e) => handleInputChange('phone', e.target.value)} 
                        disabled={isViewingAsAdmin}
                        className={validationErrors.phone ? 'border-red-500' : ''}
                      />
                      {validationErrors.phone && (
                        <p className="text-sm text-red-500">{validationErrors.phone}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="location">Your Location</Label>
                    <Input id="location" value={formData.location.address} onChange={(e) => handleInputChange('location.address', e.target.value)} disabled={isViewingAsAdmin} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="bio">About You (Public Bio)</Label>
                    <Textarea id="bio" value={formData.bio} onChange={(e) => handleInputChange('bio', e.target.value)} rows={4} disabled={isViewingAsAdmin} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="hourly_rate">Hourly Rate (£)</Label>
                    <Input id="hourly_rate" type="number" value={formData.coach_profile.hourly_rate} onChange={(e) => handleInputChange('coach_profile.hourly_rate', parseInt(e.target.value))} disabled={isViewingAsAdmin} />
                  </div>

                  <div className="space-y-3">
                    <Label>Services You Offer</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {coachingTypes.map((type) => (
                        <div key={type.value} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`service-${type.value}`} 
                            checked={formData.coach_profile.services_offered.includes(type.value)} 
                            onCheckedChange={(checked) => handleServicesChange(type.value, checked)}
                            disabled={isViewingAsAdmin}
                          />
                          <Label htmlFor={`service-${type.value}`} className="text-sm font-normal cursor-pointer">{type.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Age Groups You Coach</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {ageGroups.map((age) => (
                        <div key={age.value} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`age-${age.value}`} 
                            checked={formData.coach_profile.age_groups?.includes(age.value)} 
                            onCheckedChange={(checked) => handleAgeGroupsChange(age.value, checked)}
                            disabled={isViewingAsAdmin}
                          />
                          <Label htmlFor={`age-${age.value}`} className="text-sm font-normal cursor-pointer">{age.label}</Label>
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

                {/* Right Column - Media Upload */}
                <div className="space-y-6">
                  {/* Profile Picture */}
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

                  {/* Video Clips (external URLs only) */}
                  <div className="space-y-3">
                    <Label>Coaching Session Clips</Label>
                    <p className="text-xs text-slate-500">Link up to 3 video clips hosted on platforms like YouTube, Vimeo, or cloud storage. Paste the video URL below.</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {[1, 2, 3].map((clipNumber) => (
                        <div key={clipNumber} className="relative">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <LinkIcon className="w-4 h-4 text-slate-500" />
                              <Input
                                type="url"
                                placeholder={`https://... (Video ${clipNumber} URL)`}
                                value={formData[`video_clip_${clipNumber}`] || ''}
                                onChange={(e) => setVideoUrl(clipNumber, e.target.value)}
                                disabled={isViewingAsAdmin}
                              />
                              {!isViewingAsAdmin && formData[`video_clip_${clipNumber}`] && (
                                <Button type="button" variant="destructive" size="sm" onClick={() => removeVideo(clipNumber)}>
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                            {formData[`video_clip_${clipNumber}`] && (
                              <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-slate-200 bg-slate-900">
                                {renderEmbed(formData[`video_clip_${clipNumber}`])}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Availability Calendar - Only for coaches viewing their own profile */}
        {!isViewingAsAdmin && formData && (
          <div className="mt-6">
            <AvailabilityCalendar coachId={formData.id} isReadOnly={false} />
          </div>
        )}

        {/* Show availability calendar in read-only mode when viewing others */}
        {isViewingAsAdmin && formData && (
          <div className="mt-6">
            <AvailabilityCalendar coachId={formData.id} isReadOnly={true} />
          </div>
        )}
      </div>
    </div>
  );
}