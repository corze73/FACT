
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Shield, Zap, Target, User, BarChart, Calendar } from "lucide-react";
import { motion } from "framer-motion";

export default function CoachCard({ coach, onBook }) {
  const getServiceStyle = (service) => {
    const styles = {
      goalkeeping: { icon: User, color: "bg-orange-100 text-orange-800" },
      defense: { icon: Shield, color: "bg-blue-100 text-blue-800" },
      midfield: { icon: Zap, color: "bg-green-100 text-green-800" },
      striker: { icon: Target, color: "bg-red-100 text-red-800" },
      fitness_conditioning: { icon: BarChart, color: "bg-purple-100 text-purple-800" },
      tactical_analysis: { icon: MapPin, color: "bg-slate-100 text-slate-800" }
    };
    return styles[service] || { icon: Star, color: "bg-gray-100 text-gray-800" };
  };

  const formatServiceName = (service) => {
    return service.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const renderStars = (rating) => {
    return Array(5).fill(0).map((_, i) => (
      <Star 
        key={i} 
        className={`w-4 h-4 ${i < rating ? 'text-yellow-500 fill-current' : 'text-slate-300'}`} 
      />
    ));
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white/90 backdrop-blur-sm overflow-hidden group">
        <CardHeader className="text-center pb-4">
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-xl transition-shadow duration-300">
              <span className="text-2xl font-bold text-white">
                {coach.full_name?.charAt(0) || 'C'}
              </span>
            </div>
            {coach.coach_profile?.is_verified && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <Star className="w-3 h-3 text-white fill-current" />
              </div>
            )}
          </div>
          
          <h3 className="text-xl font-bold text-slate-900 mb-1">
            {coach.full_name}
          </h3>
          
          <div className="flex items-center justify-center gap-1 mb-2">
            {renderStars(coach.coach_profile?.rating || 0)}
            <span className="text-sm text-slate-600 ml-2">
              ({coach.coach_profile?.total_sessions || 0} sessions)
            </span>
          </div>
          
          {coach.location?.address && (
            <div className="flex items-center justify-center gap-1 text-slate-500 text-sm">
              <MapPin className="w-3 h-3" />
              <span>{coach.location.address}</span>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="px-6 pb-6">
          <div className="space-y-4">
            {/* Services */}
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                {coach.coach_profile?.services_offered?.slice(0, 3).map((service) => {
                  const { icon: Icon, color } = getServiceStyle(service);
                  return (
                    <Badge 
                      key={service} 
                      className={`text-xs ${color} flex items-center gap-1`}
                    >
                      <Icon className="w-3 h-3" />
                      {formatServiceName(service)}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Bio */}
            {coach.bio && (
              <p className="text-slate-600 text-sm line-clamp-3 leading-relaxed">
                {coach.bio}
              </p>
            )}

            {/* Price */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900">
                  £{coach.coach_profile?.hourly_rate}
                </p>
                <p className="text-xs text-slate-500">per session</p>
              </div>
              
              <Button 
                onClick={() => onBook(coach)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Book Now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
