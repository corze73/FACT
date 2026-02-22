import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
// Select components not currently used but may be needed for user role selection
import { Star, ArrowLeft, User, UserCheck, MapPin, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showSuccess, showError, devError } from "@/utils/notifications";
import { Badge } from "@/components/ui/badge";
import {
  getBackgroundCheckGuidance,
  getBackgroundCheckLabel,
  getBackgroundCheckTypeOptions
} from "@/lib/complianceConstants";

export default function Register() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authMethod, setAuthMethod] = useState('email');
  const [userType, setUserType] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const rawType = params.get('type') || 'client';
    return rawType === 'user' ? 'client' : rawType;
  });

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    bio: '',
    location: { address: '' },
    country: '',
    city: '',
    preferred_coaching_types: [],
    preferred_session_times: [],
    qualification_type: '',
    qualification_file_url: '',
    has_background_check: false,
    background_check_type: '',
    background_check_file_url: '',
    background_check_expires_at: '',
    user_type: userType,
    coach_profile: userType === 'coach' ? {
      credentials: [],
      services_offered: [],
      hourly_rate: 50,
      availability: {},
      service_radius: 25,
      age_groups: []
    } : undefined
  });
  const [isUploadingQualification, setIsUploadingQualification] = useState(false);
  const [isUploadingBackgroundCheck, setIsUploadingBackgroundCheck] = useState(false);
  const [qualificationFile, setQualificationFile] = useState(null);
  const [backgroundCheckFile, setBackgroundCheckFile] = useState(null);

  const getBackgroundLabel = () => {
    return getBackgroundCheckLabel(formData.country);
  };

  const guidance = getBackgroundCheckGuidance(formData.country);
  const backgroundTypeOptions = getBackgroundCheckTypeOptions(formData.country);
  const selectedBackgroundTypeOption = backgroundTypeOptions.some((option) => option.value === formData.background_check_type)
    ? formData.background_check_type
    : (formData.background_check_type ? '__other__' : '');

  const backgroundDraftStatus = !formData.has_background_check
    ? 'incomplete'
    : (backgroundCheckFile || formData.background_check_file_url ? 'pending' : 'incomplete');

  const statusTone = (status) => {
    if (status === 'verified') return 'bg-emerald-100 text-emerald-700';
    if (status === 'pending') return 'bg-amber-100 text-amber-700';
    if (status === 'rejected') return 'bg-red-100 text-red-700';
    return 'bg-slate-100 text-slate-700';
  };

  const uploadComplianceFile = async (file, documentType) => {
    if (!file) return null;
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      showError('Invalid file type', 'Only PDF, JPG, JPEG, and PNG files are allowed.');
      return null;
    }

    if (file.size > 10 * 1024 * 1024) {
      showError('File too large', 'Maximum file size is 10MB.');
      return null;
    }

    const { User } = await import("@/api/entities.jsx");
    const response = await User.uploadComplianceFile(file, documentType);
    return response?.data?.url || null;
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password || !formData.full_name) {
      showError('Required Fields', 'Please fill in all required fields');
      return;
    }
    
    if (formData.password.length < 6) {
      showError('Invalid Password', 'Password must be at least 6 characters long');
      return;
    }

    if (formData.user_type === 'coach' && formData.has_background_check) {
      if (!formData.background_check_type || !String(formData.background_check_type).trim()) {
        showError('Background Check Required', `Please select the ${getBackgroundLabel()} type.`);
        return;
      }
      if (!backgroundCheckFile && !formData.background_check_file_url) {
        showError('Background Check Required', 'Please upload your background check document before continuing.');
        return;
      }
    }
    
    setIsLoading(true);
    
    try {
      const { User } = await import("@/api/entities.jsx");
      
      // Sign up with email and password
      await User.signUpWithEmail(formData.email, formData.password, formData);

      if (formData.user_type === 'coach') {
        try {
          let qualificationFileUrl = formData.qualification_file_url || null;
          let backgroundFileUrl = formData.background_check_file_url || null;

          if (qualificationFile) {
            setIsUploadingQualification(true);
            qualificationFileUrl = await uploadComplianceFile(qualificationFile, 'qualification');
          }

          if (formData.has_background_check && backgroundCheckFile) {
            setIsUploadingBackgroundCheck(true);
            backgroundFileUrl = await uploadComplianceFile(backgroundCheckFile, 'background_check');
          }

          await User.updateCompliance({
            qualification_type: formData.qualification_type,
            qualification_file_url: qualificationFileUrl,
            has_background_check: formData.has_background_check,
            background_check_type: formData.background_check_type,
            background_check_file_url: backgroundFileUrl,
            background_check_expires_at: formData.background_check_expires_at || null
          });
        } catch (complianceError) {
          devError('Compliance save warning:', complianceError);
        } finally {
          setIsUploadingQualification(false);
          setIsUploadingBackgroundCheck(false);
        }
      }
      
      showSuccess('Account Created', 'Please check your email to verify your account, then you can log in.');
      navigate(createPageUrl("Landing"));
    } catch (error) {
      devError("Registration error:", error);
      if (error.message?.includes('already')) {
        showError('Account Exists', 'An account with this email already exists. Please try logging in instead.');
      } else {
        showError('Registration Failed', error.message || 'An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setIsLoading(true);
    
    try {
      // Store form data in sessionStorage before OAuth redirect
      sessionStorage.setItem('pendingProfileData', JSON.stringify(formData));
      
      const { User } = await import("@/api/entities.jsx");
      
      // Now redirect for OAuth login
      const redirectUrl = window.location.origin + createPageUrl("Landing?next=dashboard");
      await User.loginWithRedirect(redirectUrl);
    } catch (error) {
      devError("Registration error:", error);
      // Clear stored data on error
      sessionStorage.removeItem('pendingProfileData');
      showError('Registration Failed', 'Unable to register. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    if (field.startsWith('coach_profile.')) {
      const subField = field.replace('coach_profile.', '');
      setFormData(prev => ({
        ...prev,
        coach_profile: {
          ...prev.coach_profile,
          [subField]: value
        }
      }));
    } else if (field === 'location.address') {
      setFormData(prev => ({
        ...prev,
        location: { ...prev.location, address: value }
      }));
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

  return (
    <div className="min-h-screen py-12 px-6 relative">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <Button
            variant="ghost"
            className="absolute top-4 left-4 md:top-6 md:left-6 z-10"
            onClick={() => navigate(createPageUrl("Landing"))}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg mt-8 md:mt-0">
            <Star className="w-8 h-8 text-white" />
          </div>
          
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Join the Pitch
          </h1>
          <p className="text-slate-600">
            {userType === 'coach' ? 'Share your football expertise and grow your coaching business' : 'Find your perfect coach and elevate your game'}
          </p>
        </motion.div>

        {/* User Type Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant={userType === 'client' ? 'default' : 'outline'}
              className={`h-auto py-4 px-4 text-center ${userType === 'client' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
              onClick={() => {
                setUserType('client');
                setFormData(prev => ({
                  ...prev,
                  user_type: 'client',
                  coach_profile: undefined,
                  qualification_type: '',
                  qualification_file_url: '',
                  has_background_check: false,
                  background_check_type: '',
                  background_check_file_url: '',
                  background_check_expires_at: ''
                }));
              }}
            >
              <div className="flex flex-col items-center gap-2">
                <User className="w-5 h-5" />
                <span className="text-sm md:text-base leading-tight">
                  I&apos;m looking for a coach
                </span>
              </div>
            </Button>
            <Button
              variant={userType === 'coach' ? 'default' : 'outline'}
              className={`h-auto py-4 px-4 text-center ${userType === 'coach' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
              onClick={() => {
                setUserType('coach');
                setFormData(prev => ({ 
                  ...prev, 
                  user_type: 'coach',
                  coach_profile: {
                    credentials: [],
                    services_offered: [],
                    hourly_rate: 50,
                    availability: {},
                    age_groups: []
                  },
                  qualification_type: prev.qualification_type || '',
                  qualification_file_url: prev.qualification_file_url || '',
                  has_background_check: Boolean(prev.has_background_check),
                  background_check_type: prev.background_check_type || '',
                  background_check_file_url: prev.background_check_file_url || '',
                  background_check_expires_at: prev.background_check_expires_at || ''
                }));
              }}
            >
              <div className="flex flex-col items-center gap-2">
                <UserCheck className="w-5 h-5" />
                <span className="text-sm md:text-base leading-tight">
                  I&apos;m a coach
                </span>
              </div>
            </Button>
          </div>
        </motion.div>

        {/* Registration Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {userType === 'coach' ? <UserCheck className="w-5 h-5" /> : <User className="w-5 h-5" />}
                {userType === 'coach' ? 'Coach Registration' : 'Player Registration'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Authentication Method Selection */}
              <Tabs value={authMethod} onValueChange={setAuthMethod} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email & Password
                  </TabsTrigger>
                  <TabsTrigger value="google" className="flex items-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="email" className="space-y-6 mt-6">
                  <form onSubmit={handleEmailSignUp} className="space-y-6">
                    {/* Email and Password Fields */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address *</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                          <Input
                            id="email"
                            type="email"
                            placeholder="your@email.com"
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            autoComplete="off"
                            required
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password *</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Min. 6 characters"
                            value={formData.password}
                            onChange={(e) => handleInputChange('password', e.target.value)}
                            autoComplete="new-password"
                            required
                            minLength={6}
                            className="pl-10 pr-10"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Rest of the form fields */}
                    {renderFormFields()}

                    <Button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Creating Account...' : userType === 'coach' ? 'Save & Continue' : 'Create Account'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="google" className="space-y-6 mt-6">
                  <div className="space-y-6">
                    {/* Rest of the form fields */}
                    {renderFormFields()}

                    <Button
                      type="button"
                      onClick={handleGoogleSignUp}
                      className="w-full bg-red-600 hover:bg-red-700 text-white py-3 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-3"
                      disabled={isLoading}
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      {isLoading ? 'Creating Account...' : userType === 'coach' ? 'Save & Continue with Google' : 'Continue with Google'}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );

  function renderFormFields() {
    return (
      <>
                {/* Basic Information */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => handleInputChange('full_name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Your Location</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Input
                        id="country"
                        placeholder="Country (e.g., United Kingdom)"
                        value={formData.country}
                        onChange={(e) => handleInputChange('country', e.target.value)}
                        required={userType === 'coach'}
                      />
                    </div>
                    <div>
                      <Input
                        id="city"
                        placeholder="City (e.g., London)"
                        value={formData.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        required={userType === 'coach'}
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <Input
                      id="location"
                      placeholder="Full address or area (optional)"
                      value={formData.location.address}
                      onChange={(e) => handleInputChange('location.address', e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">About You</Label>
                  <Textarea
                    id="bio"
                    placeholder={userType === 'coach' ? 'Describe your coaching experience and approach...' : 'Tell us about your goals and what you\'re looking for...'}
                    value={formData.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    rows={4}
                  />
                </div>

                {/* Coach-specific fields */}
                {userType === 'coach' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="hourly_rate">Hourly Rate (£)</Label>
                      <Input
                        id="hourly_rate"
                        type="number"
                        min="1"
                        value={formData.coach_profile?.hourly_rate}
                        onChange={(e) => handleInputChange('coach_profile.hourly_rate', parseInt(e.target.value))}
                        required
                      />
                    </div>

                    <div className="space-y-3">
                      <Label>Services You Offer</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {coachingTypes.map((type) => (
                          <div key={type.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`services-${type.value}`}
                              checked={formData.coach_profile?.services_offered?.includes(type.value)}
                              onCheckedChange={(checked) => {
                                const current = formData.coach_profile?.services_offered || [];
                                if (checked) {
                                  handleInputChange('coach_profile.services_offered', [...current, type.value]);
                                } else {
                                  handleInputChange('coach_profile.services_offered', current.filter(s => s !== type.value));
                                }
                              }}
                            />
                            <Label htmlFor={`services-${type.value}`} className="text-sm">
                              {type.label}
                            </Label>
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
                              checked={formData.coach_profile?.age_groups?.includes(age.value)}
                              onCheckedChange={(checked) => {
                                const current = formData.coach_profile?.age_groups || [];
                                if (checked) {
                                  handleInputChange('coach_profile.age_groups', [...current, age.value]);
                                } else {
                                  handleInputChange('coach_profile.age_groups', current.filter(s => s !== age.value));
                                }
                              }}
                            />
                            <Label htmlFor={`age-${age.value}`} className="text-sm">
                              {age.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4 border rounded-xl p-4 bg-slate-50/60">
                      <div>
                        <h3 className="font-semibold text-slate-900">Coach Compliance</h3>
                        <p className="text-sm text-slate-600">
                          Upload your qualification and background check documents. You can finish now and complete verification later.
                        </p>
                        <div className="mt-2">
                          <Badge className={statusTone(backgroundDraftStatus)}>
                            Background Check: {backgroundDraftStatus}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="qualification_type">Qualification Type</Label>
                        <select
                          id="qualification_type"
                          className="w-full border border-slate-300 rounded-md h-10 px-3 bg-white"
                          value={formData.qualification_type || ''}
                          onChange={(e) => handleInputChange('qualification_type', e.target.value)}
                        >
                          <option value="">Select qualification</option>
                          <option value="UEFA A">UEFA A</option>
                          <option value="UEFA B">UEFA B</option>
                          <option value="UEFA C">UEFA C</option>
                          <option value="FA Level 1">FA Level 1</option>
                          <option value="FA Level 2">FA Level 2</option>
                          <option value="Safeguarding">Safeguarding</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="qualification_file">Qualification Document (PDF/JPG/PNG)</Label>
                        <Input
                          id="qualification_file"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                              setQualificationFile(file);
                          }}
                        />
                        {isUploadingQualification && <p className="text-xs text-slate-500">Uploading qualification…</p>}
                        {qualificationFile && <p className="text-xs text-emerald-700">Selected: {qualificationFile.name}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label>Do you have a current background check?</Label>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={formData.has_background_check === true}
                              onCheckedChange={(checked) => handleInputChange('has_background_check', checked === true)}
                            />
                            Yes
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
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="background_check_file">Background Check Document (PDF/JPG/PNG)</Label>
                            <Input
                              id="background_check_file"
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setBackgroundCheckFile(file);
                              }}
                            />
                            {isUploadingBackgroundCheck && <p className="text-xs text-slate-500">Uploading background check…</p>}
                            {backgroundCheckFile && <p className="text-xs text-emerald-700">Selected: {backgroundCheckFile.name}</p>}
                          </div>
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

                      <p className="text-xs text-slate-600">
                        By uploading this document you confirm it is valid and accurate. FACT may verify documentation.
                      </p>
                    </div>
                  </>
                )}

                {/* Preferences for both user types */}
                <div className="space-y-3">
                  <Label>
                    {userType === 'coach' ? 'Coaching Specialties' : 'I want to improve my...'}
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {coachingTypes.map((type) => (
                      <div key={type.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`pref-${type.value}`}
                          checked={formData.preferred_coaching_types.includes(type.value)}
                          onCheckedChange={(checked) => handleArrayChange('preferred_coaching_types', type.value, checked)}
                        />
                        <Label htmlFor={`pref-${type.value}`} className="text-sm font-normal">
                          {type.label}
                        </Label>
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
                        />
                        <Label htmlFor={`time-${time.value}`} className="text-sm">
                          {time.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
      </>
    );
  }
}