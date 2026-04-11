import Layout from "./Layout.jsx";

import Landing from "./Landing";

import Register from "./Register";

import FindCoaches from "./FindCoaches";

import MyBookings from "./MyBookings";

import CoachDashboard from "./CoachDashboard";

import UserProfile from "./UserProfile";

import CoachProfile from "./CoachProfile";

import Help from "./Help";

import Messages from "./Messages";

import Conversation from "./Conversation";

import AdminDashboard from "./AdminDashboard";

import AdminUsers from "./AdminUsers";

import AdminBookings from "./AdminBookings";

import AdminVerifications from "./AdminVerifications";

import AdminAuditLogs from "./AdminAuditLogs";

import AdminOperations from "./AdminOperations";

import AdminInvite from "./AdminInvite";

import ForgotPassword from "./ForgotPassword";

import ResetPassword from "./ResetPassword";

import PrivacyPolicy from "./PrivacyPolicy";

import Terms from "./Terms";

import DataDiagnostic from "../components/DataDiagnostic";
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Landing: Landing,
    
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
    
    DataDiagnostic: DataDiagnostic,
    
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
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Landing />} />
                
                
                <Route path="/Landing" element={<Landing />} />
                <Route path="/landing" element={<Landing />} />
                
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
                
                <Route path="/DataDiagnostic" element={<DataDiagnostic />} />
                <Route path="/datadiagnostic" element={<DataDiagnostic />} />
                
            </Routes>
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