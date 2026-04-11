import { useState, useEffect, useCallback, useMemo } from "react";
import { User } from "@/api/entities.jsx";
import { Booking } from "@/api/entities.jsx";
import { getStoredCurrentUser } from "@/api/databaseClient.js";
import { useCoaches } from "@/hooks/useQueries.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Users, Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { showSuccess, showError, devLog, devError } from "@/utils/notifications";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl, isAdminUser } from "@/utils";
import CoachCard from "../components/coaches/CoachCard";
import BookingModal from "../components/booking/BookingModal";

const COACHES_PER_PAGE = 24;

const getCachedCurrentUser = async () => getStoredCurrentUser();

export default function FindCoaches() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [debouncedCountry, setDebouncedCountry] = useState('');
  const [debouncedCity, setDebouncedCity] = useState('');
  
  const [filters, setFilters] = useState({
    searchTerm: '',
    serviceType: 'all',
    priceRange: 'all',
    rating: 'all',
    country: '',
    city: '',
    verifiedBackgroundOnly: false
  });

  const effectiveFilters = useMemo(() => ({
    ...filters,
    searchTerm: debouncedSearchTerm,
    country: debouncedCountry,
    city: debouncedCity
  }), [filters, debouncedSearchTerm, debouncedCountry, debouncedCity]);

  const coachQueryFilters = useMemo(() => {
    const params = {
      limit: COACHES_PER_PAGE,
      offset: (currentPage - 1) * COACHES_PER_PAGE,
      include_total: '1'
    };

    if (effectiveFilters.searchTerm) params.q = effectiveFilters.searchTerm;
    if (effectiveFilters.country) params.country = effectiveFilters.country;
    if (effectiveFilters.city) params.city = effectiveFilters.city;
    if (effectiveFilters.serviceType !== 'all') params.service_type = effectiveFilters.serviceType;

    if (effectiveFilters.priceRange !== 'all') {
      const [min, max] = effectiveFilters.priceRange.split('-').map(Number);
      if (Number.isFinite(min)) params.min_rate = min;
      if (Number.isFinite(max)) params.max_rate = max;
    }

    if (effectiveFilters.rating !== 'all') {
      const minRating = parseFloat(effectiveFilters.rating);
      if (Number.isFinite(minRating)) params.min_rating = minRating;
    }

    if (effectiveFilters.verifiedBackgroundOnly) {
      params.verified_background = '1';
    }

    return params;
  }, [effectiveFilters, currentPage]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchTerm(filters.searchTerm.trim());
      setDebouncedCountry(filters.country.trim());
      setDebouncedCity(filters.city.trim());
    }, 300);

    return () => clearTimeout(timeout);
  }, [filters.searchTerm, filters.country, filters.city]);

  const coachesQuery = useCoaches(coachQueryFilters);
  const coachesResponse = coachesQuery.data;
  const coaches = useMemo(
    () => (Array.isArray(coachesResponse?.data) ? coachesResponse.data : Array.isArray(coachesResponse) ? coachesResponse : []),
    [coachesResponse]
  );
  const totalCoaches = Array.isArray(coachesResponse?.data)
    ? Number(coachesResponse?.total || 0)
    : coaches.length;
  const isLoading = coachesQuery.isLoading;
  const isFetching = coachesQuery.isFetching;

  useEffect(() => {
    // Redirect admins to AdminDashboard, allow guests to browse
    (async () => {
      try {
        const me = await User.me();
        if (isAdminUser(me)) {
          navigate(createPageUrl("AdminDashboard"));
          return;
        }
        // Authenticated non-admin user - allow browse
        setCurrentUser(me);
      } catch (error) {
        const status = Number(error?.status || 0);
        const message = String(error?.message || '').toLowerCase();
        const isAuthFailure = status === 401 || message.includes('not authenticated') || message.includes('unauthorized');

        if (isAuthFailure) {
          // User not authenticated - allow browsing as guest
          setCurrentUser(null);
          devLog("Loading coaches for guest user");
          return;
        }

        const cachedUser = await getCachedCurrentUser();
        if (cachedUser && !isAdminUser(cachedUser)) {
          setCurrentUser(cachedUser);
          devError("FindCoaches auth refresh failed; using cached user state:", error);
          return;
        }

        setCurrentUser(null);
        devError("FindCoaches auth refresh failed with no cached user:", error);
      }
    })();
  }, [navigate]);

  useEffect(() => {
    if (!coachesQuery.error) return;
    devError("Error loading data:", coachesQuery.error);
    showError('Coach Search Failed', coachesQuery.error.message || 'Unable to load coaches. Please try again.');
  }, [coachesQuery.error]);

  const totalPages = Math.ceil(totalCoaches / COACHES_PER_PAGE);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    filters.serviceType,
    filters.priceRange,
    filters.rating,
    filters.verifiedBackgroundOnly,
    debouncedSearchTerm,
    debouncedCountry,
    debouncedCity
  ]);

  const handleBookCoach = (coach) => {
    setSelectedCoach(coach);
    setShowBookingModal(true);
  };

  const renderedCoachCards = useMemo(() => (
    coaches.map((coach, index) => (
      <motion.div
        key={coach.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ delay: index * 0.05 }}
      >
        <CoachCard
          coach={coach}
          onBook={() => handleBookCoach(coach)}
          isGuest={!currentUser}
        />
      </motion.div>
    ))
  ), [coaches, currentUser, handleBookCoach]);

  const clearFilters = () => {
    setFilters({
      searchTerm: '',
      serviceType: 'all',
      priceRange: 'all',
      rating: 'all',
      country: '',
      city: '',
      verifiedBackgroundOnly: false
    });
    setCurrentPage(1);
  };

  // Check if any filters are active
  const hasActiveFilters = filters.searchTerm || 
    filters.serviceType !== 'all' || 
    filters.priceRange !== 'all' || 
    filters.rating !== 'all' || 
    filters.country ||
    filters.city ||
    filters.verifiedBackgroundOnly;

  const handleBookingSubmit = async (bookingData) => {
    try {
      devLog('Submitting booking with data:', {
        ...bookingData,
        user_id: currentUser.id,
        client_id: currentUser.id,
        coach_id: selectedCoach.id,
        status: 'pending'
      });
      
      await Booking.create({
        ...bookingData,
        user_id: currentUser.id,
        client_id: currentUser.id,
        coach_id: selectedCoach.id,
        status: 'pending'
      });
      
      setShowBookingModal(false);
      setSelectedCoach(null);
      
      showSuccess('Booking Requested', `Your booking request has been sent to ${selectedCoach.full_name}!`);
    } catch (error) {
      devError("Error creating booking:", error);
      showError('Booking Failed', error.message || 'Unable to create booking. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="animate-pulse">
                <Card className="h-80">
                  <CardHeader>
                    <div className="w-16 h-16 bg-slate-200 rounded-full mx-auto mb-4"></div>
                    <div className="h-4 bg-slate-200 rounded mb-2"></div>
                    <div className="h-3 bg-slate-200 rounded"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-slate-200 rounded"></div>
                      <div className="h-3 bg-slate-200 rounded w-3/4"></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Guest User Banner */}
        {!currentUser && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">
                      👋 Browsing as a guest
                    </h3>
                    <p className="text-sm text-slate-600">
                      Sign up to see coach names and book sessions
                    </p>
                  </div>
                  <Button 
                    onClick={() => navigate(createPageUrl("Register"))}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Sign Up Free
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Find Your Football Coach</h1>
          <p className="text-slate-600">
            Discover expert football coaches ready to help you elevate your game.
          </p>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="grid lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2 relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search coaches..."
                    className="pl-10"
                    value={filters.searchTerm}
                    onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                  />
                </div>

                <Select
                  value={filters.serviceType}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, serviceType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Specialization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Specializations</SelectItem>
                    <SelectItem value="striker">Striker</SelectItem>
                    <SelectItem value="midfield">Midfield</SelectItem>
                    <SelectItem value="defense">Defense</SelectItem>
                    <SelectItem value="goalkeeping">Goalkeeping</SelectItem>
                    <SelectItem value="fitness_conditioning">Fitness</SelectItem>
                    <SelectItem value="tactical_analysis">Tactics</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.priceRange}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, priceRange: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Price Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Price</SelectItem>
                    <SelectItem value="0-30">£0 - £30</SelectItem>
                    <SelectItem value="30-60">£30 - £60</SelectItem>
                    <SelectItem value="60-100">£60 - £100</SelectItem>
                    <SelectItem value="100">£100+</SelectItem>
                  </SelectContent>
                </Select>

                <div>
                  <Input
                    placeholder="Country"
                    value={filters.country}
                    onChange={(e) => setFilters(prev => ({ ...prev, country: e.target.value }))}
                  />
                </div>

                <div>
                  <Input
                    placeholder="City"
                    value={filters.city}
                    onChange={(e) => setFilters(prev => ({ ...prev, city: e.target.value }))}
                  />
                </div>

                <div className="lg:col-span-5 flex items-center gap-2 pt-1">
                  <Checkbox
                    id="verified-background-only"
                    checked={filters.verifiedBackgroundOnly === true}
                    onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, verifiedBackgroundOnly: checked === true }))}
                  />
                  <label htmlFor="verified-background-only" className="text-sm text-slate-700 cursor-pointer">
                    Verified background check only
                  </label>
                </div>
              </div>

              {hasActiveFilters && (
                <Button 
                  variant="outline" 
                  onClick={clearFilters}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Results Summary */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div className="flex justify-between items-center">
            <p className="text-slate-600">
              Found {totalCoaches} coach{totalCoaches !== 1 ? 'es' : ''}
            </p>
            <div className="flex gap-2">
              {isFetching && !isLoading && (
                <Badge variant="outline" className="text-blue-700 border-blue-200">Updating...</Badge>
              )}
              <Badge variant="outline" className="flex items-center gap-1">
                <Filter className="w-3 h-3" />
                {Object.values(filters).filter(f => f && f !== 'all').length} filters active
              </Badge>
            </div>
          </div>
        </motion.div>

        {/* Coaches Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {renderedCoachCards}
          </AnimatePresence>
        </div>

        {/* Pagination Controls */}
        {totalCoaches > COACHES_PER_PAGE && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 flex items-center justify-center gap-2"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            
            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  // Show first page, last page, current page, and pages around current
                  return page === 1 || 
                         page === totalPages || 
                         Math.abs(page - currentPage) <= 1;
                })
                .map((page, idx, arr) => (
                  <div key={page} className="flex items-center gap-2">
                    {idx > 0 && arr[idx - 1] !== page - 1 && (
                      <span className="text-slate-400">...</span>
                    )}
                    <Button
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-10"
                    >
                      {page}
                    </Button>
                  </div>
                ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </motion.div>
        )}

        {/* Results count */}
        {totalCoaches > 0 && (
          <div className="mt-4 text-center text-sm text-slate-600">
            Showing {((currentPage - 1) * COACHES_PER_PAGE) + 1} - {Math.min(currentPage * COACHES_PER_PAGE, totalCoaches)} of {totalCoaches} coaches
          </div>
        )}

        {coaches.length === 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-12 h-12 text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">
              {coaches.length === 0 ? 'No coaches yet' : 'No coaches found'}
            </h3>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              {coaches.length === 0 
                ? 'Be the first to join FACT as a coach and start building your coaching business!'
                : 'Try adjusting your search criteria or filters to find more coaches'
              }
            </p>
            
            {coaches.length === 0 ? (
              <Button
                onClick={() => navigate(createPageUrl("Register?type=coach"))}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Plus className="w-5 h-5 mr-2" />
                Become a Coach
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setFilters({
                  searchTerm: '',
                  serviceType: 'all',
                  priceRange: 'all',
                  rating: 'all',
                  country: '',
                  city: ''
                })}
              >
                Clear all filters
              </Button>
            )}
          </motion.div>
        )}
      </div>

      {/* Booking Modal */}
      <BookingModal
        isOpen={showBookingModal}
        onClose={() => {
          setShowBookingModal(false);
          setSelectedCoach(null);
        }}
        coach={selectedCoach}
        onSubmit={handleBookingSubmit}
      />
    </div>
  );
}
