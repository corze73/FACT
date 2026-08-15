import Layout from "./Layout.jsx";
import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const Landing = lazy(() => import('./Landing'));
const Login = lazy(() => import('./Login'));
const Register = lazy(() => import('./Register'));
const FindCoaches = lazy(() => import('./FindCoaches'));
const MyBookings = lazy(() => import('./MyBookings'));
const CoachDashboard = lazy(() => import('./CoachDashboard'));
const UserProfile = lazy(() => import('./UserProfile'));
const CoachProfile = lazy(() => import('./CoachProfile'));
const Help = lazy(() => import('./Help'));
const Messages = lazy(() => import('./Messages'));
const Conversation = lazy(() => import('./Conversation'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const AdminUsers = lazy(() => import('./AdminUsers'));
const AdminBookings = lazy(() => import('./AdminBookings'));
const AdminVerifications = lazy(() => import('./AdminVerifications'));
const AdminAuditLogs = lazy(() => import('./AdminAuditLogs'));
const AdminOperations = lazy(() => import('./AdminOperations'));
const AdminInvite = lazy(() => import('./AdminInvite'));
const ForgotPassword = lazy(() => import('./ForgotPassword'));
const ResetPassword = lazy(() => import('./ResetPassword'));
const PrivacyPolicy = lazy(() => import('./PrivacyPolicy'));
const Terms = lazy(() => import('./Terms'));
const SafeguardingReport = lazy(() => import('./SafeguardingReport'));
const SafeguardingPolicy = lazy(() => import('./SafeguardingPolicy'));
const NotFound = lazy(() => import('./NotFound'));

const PAGES = {
    
    Landing: Landing,

    Login: Login,
    
    Register: Register,
    
    FindCoaches: FindCoaches,
    
    MyBookings: MyBookings,
    
    CoachDashboard: CoachDashboard,
    
    UserProfile: UserProfile,
    
    CoachProfile: CoachProfile,

    Help: Help,
    
    Messages: Messages,
    
    Conversation: Conversation,
    
    AdminDashboard: AdminDashboard,
    
    AdminUsers: AdminUsers,
    
    AdminBookings: AdminBookings,

    AdminVerifications: AdminVerifications,

    AdminAuditLogs: AdminAuditLogs,

    AdminOperations: AdminOperations,

    AdminInvite: AdminInvite,
    
    ForgotPassword: ForgotPassword,
    
    ResetPassword: ResetPassword,

    PrivacyPolicy: PrivacyPolicy,
    
    Terms: Terms,

    SafeguardingReport: SafeguardingReport,

    SafeguardingPolicy: SafeguardingPolicy,

    NotFound: NotFound,
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || 'NotFound';
}

function PageLoading() {
    return (
        <div className="flex min-h-[50vh] items-center justify-center px-6" role="status" aria-live="polite">
            <p className="font-medium text-slate-600">Loading page…</p>
        </div>
    );
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
          <Suspense fallback={<PageLoading />}>
            <Routes>            
                
                    <Route path="/" element={<Landing />} />
                
                
                <Route path="/Landing" element={<Landing />} />
                <Route path="/landing" element={<Landing />} />

                <Route path="/Login" element={<Login />} />
                <Route path="/login" element={<Login />} />
                
                <Route path="/Register" element={<Register />} />
                <Route path="/register" element={<Register />} />
                
                <Route path="/FindCoaches" element={<FindCoaches />} />
                <Route path="/findcoaches" element={<FindCoaches />} />
                
                <Route path="/MyBookings" element={<MyBookings />} />
                <Route path="/mybookings" element={<MyBookings />} />
                
                <Route path="/CoachDashboard" element={<CoachDashboard />} />
                <Route path="/coachdashboard" element={<CoachDashboard />} />
                
                <Route path="/UserProfile" element={<UserProfile />} />
                <Route path="/userprofile" element={<UserProfile />} />
                
                <Route path="/CoachProfile" element={<CoachProfile />} />
                <Route path="/coachprofile" element={<CoachProfile />} />

                <Route path="/Help" element={<Help />} />
                <Route path="/help" element={<Help />} />

                <Route path="/SafeguardingReport" element={<SafeguardingReport />} />
                <Route path="/safeguardingreport" element={<SafeguardingReport />} />
                
                <Route path="/Messages" element={<Messages />} />
                <Route path="/messages" element={<Messages />} />
                
                <Route path="/Conversation" element={<Conversation />} />
                <Route path="/conversation" element={<Conversation />} />
                
                <Route path="/AdminDashboard" element={<AdminDashboard />} />
                <Route path="/admindashboard" element={<AdminDashboard />} />
                
                <Route path="/AdminUsers" element={<AdminUsers />} />
                <Route path="/adminusers" element={<AdminUsers />} />
                
                <Route path="/AdminBookings" element={<AdminBookings />} />
                <Route path="/adminbookings" element={<AdminBookings />} />

                <Route path="/AdminVerifications" element={<AdminVerifications />} />
                <Route path="/adminverifications" element={<AdminVerifications />} />

                <Route path="/AdminAuditLogs" element={<AdminAuditLogs />} />
                <Route path="/adminauditlogs" element={<AdminAuditLogs />} />

                <Route path="/AdminOperations" element={<AdminOperations />} />
                <Route path="/adminoperations" element={<AdminOperations />} />

                <Route path="/AdminInvite" element={<AdminInvite />} />
                <Route path="/admininvite" element={<AdminInvite />} />

                <Route path="/ForgotPassword" element={<ForgotPassword />} />
                <Route path="/forgotpassword" element={<ForgotPassword />} />

                <Route path="/ResetPassword" element={<ResetPassword />} />
                <Route path="/resetpassword" element={<ResetPassword />} />
                
                <Route path="/PrivacyPolicy" element={<PrivacyPolicy />} />
                <Route path="/privacypolicy" element={<PrivacyPolicy />} />
                
                <Route path="/Terms" element={<Terms />} />
                <Route path="/terms" element={<Terms />} />

                <Route path="/SafeguardingPolicy" element={<SafeguardingPolicy />} />
                <Route path="/safeguardingpolicy" element={<SafeguardingPolicy />} />

                <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}
