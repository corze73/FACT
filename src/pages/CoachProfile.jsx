import { useState, useEffect, useRef } from "react";
import { User } from "@/api/entities.jsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Upload, X, Link as LinkIcon, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl, isAdminUser } from "@/utils";
import AvailabilityCalendar from "@/components/coaches/AvailabilityCalendar";
import { validateAndSanitize, profileUpdateSchema, coachProfileSchema, formatValidationErrors } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rateLimiter";
import {
  getBackgroundCheckDisplayStatus,
  getBackgroundCheckGuidance,
  getBackgroundCheckLabel,
  getBackgroundCheckTypeOptions
} from "@/lib/complianceConstants";

// This component is very similar to UserProfile, but includes coach-specific fields.
// In a larger app, this could be refactored to reduce duplication.

export default function CoachProfile() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isViewingAsAdmin, setIsViewingAsAdmin] = useState(false);
  const [, setUploadingImage] = useState(false); // value not read; only setter used
  const [isUploadingQualification, setIsUploadingQualification] = useState(false);
  const [isUploadingBackgroundCheck, setIsUploadingBackgroundCheck] = useState(false);
  const [isViewingAnotherProfile, setIsViewingAnotherProfile] = useState(false);
  const fileInputRef = useRef(null);
  // Refs for video URL inputs (for clearing values reliably)
  const videoInputRefs = {
    1: useRef(null),
    2: useRef(null),
    3: useRef(null)
  };

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
        setIsViewingAnotherProfile(true);
        userToLoad = await User.get(userIdParam);
        console.log('Loaded coach:', userToLoad.full_name);
      } else {
        // User viewing their own profile
        console.log('User viewing own profile');
        setIsViewingAnotherProfile(false);
        userToLoad = loggedInUser;
      }
      
      setFormData({
        id: userToLoad.id,
        member_public_id: userToLoad.member_public_id || '',
        full_name: userToLoad.full_name || '',
        phone: userToLoad.phone || '',
        location: { address: userToLoad.location?.address || userToLoad.location || '' },
        country: userToLoad.country || '',
        city: userToLoad.city || '',
        bio: userToLoad.bio || '',
        avatar_url: userToLoad.avatar_url || '',
        video_clip_1: userToLoad.video_clip_1 || '',
        video_clip_2: userToLoad.video_clip_2 || '',
        video_clip_3: userToLoad.video_clip_3 || '',
        qualification_type: userToLoad.qualification_type || '',
        qualification_file_url: userToLoad.qualification_file_url || '',
        qualification_status: userToLoad.qualification_status || 'incomplete',
        has_background_check: Boolean(userToLoad.has_background_check),
        background_check_type: userToLoad.background_check_type || '',
        background_check_file_url: userToLoad.background_check_file_url || '',
        background_check_status: userToLoad.background_check_status || 'incomplete',
        background_check_expires_at: userToLoad.background_check_expires_at || '',
        verification_notes: userToLoad.verification_notes || '',
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
      const youtubeParams = 'rel=0&modestbranding=1&iv_load_policy=3';
      // YouTube patterns
      if (u.hostname === 'youtu.be') {
        const id = u.pathname.replace('/', '');
        return <iframe className="w-full h-full" src={`https://www.youtube-nocookie.com/embed/${id}?${youtubeParams}`} title="YouTube video" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />;
      }
      if (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') {
        const v = u.searchParams.get('v');
        if (v) {
          return <iframe className="w-full h-full" src={`https://www.youtube-nocookie.com/embed/${v}?${youtubeParams}`} title="YouTube video" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />;
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
    } catch {
      // Invalid URL; handled by earlier checks
    }
    // Fallback link (though not expected due to allowlist)
    return <a href={url} target="_blank" rel="noreferrer" className="block w-full h-full text-center text-slate-200 flex items-center justify-center">Open video</a>;
  };

  const removeVideo = (clipNumber) => {
    setFormData(prev => ({ ...prev, [`video_clip_${clipNumber}`]: '' }));
    if (videoInputRefs[clipNumber].current) {
      videoInputRefs[clipNumber].current.value = '';
    }
  };

  const getBackgroundLabel = () => {
    return getBackgroundCheckLabel(formData?.country);
  };

  const guidance = getBackgroundCheckGuidance(formData?.country);
  const backgroundTypeOptions = getBackgroundCheckTypeOptions(formData?.country);
  const selectedBackgroundTypeOption = backgroundTypeOptions.some((option) => option.value === formData?.background_check_type)
    ? formData?.background_check_type
    : (formData?.background_check_type ? '__other__' : '');
  const backgroundDisplayStatus = getBackgroundCheckDisplayStatus(
    formData?.background_check_status,
    formData?.background_check_expires_at
  );

  const getStatusTone = (status) => {
    switch (status) {
      case 'verified': return 'bg-emerald-100 text-emerald-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'expired': return 'bg-orange-100 text-orange-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const uploadComplianceFile = async (file, type) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only PDF, JPG, JPEG, and PNG files are allowed.');
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Maximum file size is 10MB.');
      return null;
    }

    const response = await User.uploadComplianceFile(file, type);
    return response?.data?.url || null;
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

      const country = (formData.country || '').trim();
      const city = (formData.city || '').trim();
      if (!isViewingAsAdmin && (!country || !city)) {
        const locationErrors = {};
        if (!country) locationErrors.country = 'Country is required for coach profiles';
        if (!city) locationErrors.city = 'City is required for coach profiles';
        setValidationErrors((prev) => ({ ...prev, ...locationErrors }));
        alert('Please add both Country and City before saving your coach profile.');
        return;
      }

      if (!isViewingAsAdmin && formData.has_background_check && !formData.background_check_file_url) {
        alert('Please upload your background check document before saving.');
        return;
      }

      if (!isViewingAsAdmin && formData.has_background_check && !String(formData.background_check_type || '').trim()) {
        alert(`Please select your ${getBackgroundLabel()} type before saving.`);
        return;
      }
      
      // Merge validated data
      const dataToSave = {
        ...formData,
        ...validatedProfile,
        location: { address: validatedProfile.location || '' },
        coach_profile: validatedCoach,
      };
      
      setIsSaving(true);
      await User.updateMyUserData(dataToSave);

      await User.updateCompliance({
        qualification_type: formData.qualification_type,
        qualification_file_url: formData.qualification_file_url,
        has_background_check: formData.has_background_check,
        background_check_type: formData.background_check_type,
        background_check_file_url: formData.background_check_file_url,
        background_check_expires_at: formData.background_check_expires_at || null
      });

      const awaitingApproval = Boolean(formData.qualification_file_url) || Boolean(formData.background_check_file_url);
      if (awaitingApproval) {
        alert("Profile and compliance saved. Your documents are now awaiting admin approval.");
      } else {
        alert("Profile updated successfully! ✅");
      }
      
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

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(isAdminUser(currentUser) ? createPageUrl("AdminUsers") : createPageUrl("FindCoaches"));
  };

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {isViewingAnotherProfile && (
          <Button variant="ghost" size="sm" className="mb-4" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        )}

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
                  <div className="space-y-2">
                    <Label htmlFor="member_public_id">Member ID</Label>
                    <Input
                      id="member_public_id"
                      value={formData.member_public_id || 'Will be assigned automatically'}
                      readOnly
                      disabled
                    />
                    <p className="text-xs text-slate-500">This unique ID is assigned automatically and cannot be edited.</p>
                  </div>

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
                        placeholder="e.g. +44 20 7946 0958"
                        value={formData.phone} 
                        onChange={(e) => handleInputChange('phone', e.target.value)} 
                        disabled={isViewingAsAdmin}
                        className={validationErrors.phone ? 'border-red-500' : ''}
                      />
                      <p className="text-xs text-slate-500">Include country code when possible. Spaces, dashes, and parentheses are supported.</p>
                      {validationErrors.phone && (
                        <p className="text-sm text-red-500">{validationErrors.phone}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Your Location</Label>
                    <div className="grid grid-cols-2 gap-4 mb-2">
                      <div>
                        <Input 
                          id="country"
                          placeholder="Country"
                          value={formData.country} 
                          onChange={(e) => handleInputChange('country', e.target.value)} 
                          disabled={isViewingAsAdmin}
                          className={validationErrors.country ? 'border-red-500' : ''}
                        />
                        {validationErrors.country && (
                          <p className="text-sm text-red-500 mt-1">{validationErrors.country}</p>
                        )}
                      </div>
                      <div>
                        <Input 
                          id="city"
                          placeholder="City"
                          value={formData.city} 
                          onChange={(e) => handleInputChange('city', e.target.value)} 
                          disabled={isViewingAsAdmin}
                          className={validationErrors.city ? 'border-red-500' : ''}
                        />
                        {validationErrors.city && (
                          <p className="text-sm text-red-500 mt-1">{validationErrors.city}</p>
                        )}
                      </div>
                    </div>
                    <Input 
                      id="location"
                      placeholder="Full address (optional)"
                      value={formData.location.address} 
                      onChange={(e) => handleInputChange('location.address', e.target.value)} 
                      disabled={isViewingAsAdmin}
                    />
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

                  <div className="space-y-4 border rounded-xl p-4 bg-slate-50/60">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900">Compliance</h3>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusTone(formData.qualification_status)}>
                          Qualification: {formData.qualification_status || 'incomplete'}
                        </Badge>
                        <Badge className={getStatusTone(backgroundDisplayStatus)}>
                          Background Check: {backgroundDisplayStatus || 'incomplete'}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="qualification_type">Qualification type</Label>
                      <Input
                        id="qualification_type"
                        value={formData.qualification_type || ''}
                        onChange={(e) => handleInputChange('qualification_type', e.target.value)}
                        disabled={isViewingAsAdmin}
                        placeholder="UEFA A, FA Level 2, etc."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="qualification_file">Qualification document (PDF/JPG/PNG)</Label>
                      {!isViewingAsAdmin && (
                        <Input
                          id="qualification_file"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setIsUploadingQualification(true);
                            try {
                              const url = await uploadComplianceFile(file, 'qualification');
                              if (url) setFormData(prev => ({ ...prev, qualification_file_url: url, qualification_status: 'pending' }));
                            } catch (error) {
                              alert(error.message || 'Failed to upload qualification document');
                            } finally {
                              setIsUploadingQualification(false);
                            }
                          }}
                        />
                      )}
                      {isUploadingQualification && <p className="text-xs text-slate-500">Uploading qualification…</p>}
                      {formData.qualification_file_url && (!isViewingAsAdmin || currentUser?.user_type === 'admin') && (
                        <a href={formData.qualification_file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
                          View uploaded qualification document
                        </a>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Do you have a current background check?</Label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <Checkbox
                            checked={formData.has_background_check === true}
                            onCheckedChange={(checked) => handleInputChange('has_background_check', checked === true)}
                            disabled={isViewingAsAdmin}
                          />
                          Yes
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <Checkbox
                            checked={formData.has_background_check === false}
                            onCheckedChange={(checked) => {
                              if (checked === true) {
                                handleInputChange('has_background_check', false);
                              }
                            }}
                            disabled={isViewingAsAdmin}
                          />
                          No
                        </label>
                      </div>
                    </div>

                    {formData.has_background_check ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="background_check_type">{getBackgroundLabel()} type</Label>
                          <select
                            id="background_check_type"
                            className="w-full border border-slate-300 rounded-md h-10 px-3 bg-white"
                            value={selectedBackgroundTypeOption}
                            onChange={(e) => {
                              const selected = e.target.value;
                              if (selected === '__other__') {
                                handleInputChange('background_check_type', 'Other');
                                return;
                              }
                              handleInputChange('background_check_type', selected);
                            }}
                            disabled={isViewingAsAdmin}
                          >
                            <option value="">Select type</option>
                            {backgroundTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>

                        {selectedBackgroundTypeOption === '__other__' && (
                          <div className="space-y-2">
                            <Label htmlFor="background_check_type_other">Other type</Label>
                            <Input
                              id="background_check_type_other"
                              value={formData.background_check_type || ''}
                              onChange={(e) => handleInputChange('background_check_type', e.target.value)}
                              disabled={isViewingAsAdmin}
                              placeholder="Enter background check type"
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="background_check_expires_at">Expiry date (optional)</Label>
                          <Input
                            id="background_check_expires_at"
                            type="date"
                            value={formData.background_check_expires_at || ''}
                            onChange={(e) => handleInputChange('background_check_expires_at', e.target.value)}
                            disabled={isViewingAsAdmin}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="background_check_file">{getBackgroundLabel()} document (PDF/JPG/PNG)</Label>
                          {!isViewingAsAdmin && (
                            <Input
                              id="background_check_file"
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setIsUploadingBackgroundCheck(true);
                                try {
                                  const url = await uploadComplianceFile(file, 'background_check');
                                  if (url) setFormData(prev => ({ ...prev, background_check_file_url: url, background_check_status: 'pending' }));
                                } catch (error) {
                                  alert(error.message || 'Failed to upload background check document');
                                } finally {
                                  setIsUploadingBackgroundCheck(false);
                                }
                              }}
                            />
                          )}
                          {isUploadingBackgroundCheck && <p className="text-xs text-slate-500">Uploading {getBackgroundLabel()}…</p>}
                          {formData.background_check_file_url && (!isViewingAsAdmin || currentUser?.user_type === 'admin') && (
                            <a href={formData.background_check_file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
                              View uploaded {getBackgroundLabel()} document
                            </a>
                          )}
                        </div>

                        <p className="text-xs text-slate-600">
                          By uploading this document you confirm it is valid and accurate. FACT may verify documentation.
                        </p>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-slate-600">{guidance.helpText}</p>
                        {guidance.linkUrl && (
                          <a className="text-blue-600 underline text-sm" href={guidance.linkUrl} target="_blank" rel="noreferrer">
                            {guidance.linkLabel}
                          </a>
                        )}
                        <p className="text-xs text-slate-600">{guidance.note}</p>
                      </div>
                    )}

                    {formData.verification_notes && (formData.qualification_status === 'rejected' || formData.background_check_status === 'rejected') && (
                      <p className="text-sm text-red-700 bg-red-50 rounded-md p-2">
                        Verification notes: {formData.verification_notes}
                      </p>
                    )}
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
                    <p className="text-xs text-slate-500">Link up to 3 video clips hosted on YouTube or Vimeo. Paste the video URL below.</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {[1, 2, 3].map((clipNumber) => (
                        <div key={clipNumber} className="relative">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <LinkIcon className="w-4 h-4 text-slate-500" />
                              <Input
                                ref={videoInputRefs[clipNumber]}
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