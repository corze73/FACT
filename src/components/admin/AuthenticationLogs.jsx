import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Mail, 
  Shield, 
  Users,
  RefreshCw,
  Eye
} from "lucide-react";
import { AuthLogger } from "@/api/authLogger";

export default function AuthenticationLogs() {
  const [authLogs, setAuthLogs] = useState([]);
  const [authStats, setAuthStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('24 hours');

  const timeframeOptions = [
    { value: '1 hour', label: 'Last Hour' },
    { value: '24 hours', label: 'Last 24 Hours' },
    { value: '7 days', label: 'Last 7 Days' },
    { value: '30 days', label: 'Last 30 Days' }
  ];

  const loadAuthData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load recent authentication logs
      const recentLogs = await AuthLogger.getRecentAuthLogs(100);
      setAuthLogs(recentLogs);

      // Load authentication statistics
      const stats = await AuthLogger.getAuthStats(selectedTimeframe);
      setAuthStats(stats);

    } catch (err) {
      console.error('Failed to load auth data:', err);
      setError('Failed to load authentication data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedTimeframe]);

  useEffect(() => {
    loadAuthData();
  }, [loadAuthData]);

  const getEventIcon = (eventType, success) => {
    if (success) {
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    }
    
    switch (eventType) {
      case 'signup':
        return <Users className="w-4 h-4 text-red-600" />;
      case 'signin':
        return <Shield className="w-4 h-4 text-red-600" />;
      default:
        return <XCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const getEventBadgeColor = (eventType, success) => {
    if (success) return 'success';
    return 'destructive';
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getFailureCount = (logs) => {
    return logs.filter(log => !log.success).length;
  };

  const getSuccessCount = (logs) => {
    return logs.filter(log => log.success).length;
  };

  const getRecentFailures = () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return authLogs.filter(log => 
      !log.success && new Date(log.timestamp) > oneDayAgo
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading authentication logs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-4"
            onClick={loadAuthData}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const recentFailures = getRecentFailures();
  const totalAttempts = authLogs.length;
  const failureCount = getFailureCount(authLogs);
  const successCount = getSuccessCount(authLogs);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Authentication Monitoring</h1>
          <p className="text-muted-foreground">
            Monitor user authentication events and security incidents
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="border rounded px-3 py-2"
          >
            {timeframeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          
          <Button onClick={loadAuthData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAttempts}</div>
            <p className="text-xs text-muted-foreground">
              Authentication attempts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{successCount}</div>
            <p className="text-xs text-muted-foreground">
              {totalAttempts > 0 ? Math.round((successCount / totalAttempts) * 100) : 0}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failureCount}</div>
            <p className="text-xs text-muted-foreground">
              {totalAttempts > 0 ? Math.round((failureCount / totalAttempts) * 100) : 0}% failure rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Failures</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{recentFailures.length}</div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alert for High Failure Rate */}
      {failureCount > 0 && totalAttempts > 0 && (failureCount / totalAttempts) > 0.2 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>High Failure Rate Alert:</strong> {Math.round((failureCount / totalAttempts) * 100)}% of recent authentication attempts have failed. 
            This may indicate a system issue or security concern.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs for Different Views */}
      <Tabs defaultValue="recent" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recent">Recent Events</TabsTrigger>
          <TabsTrigger value="failures">Failed Attempts</TabsTrigger>
          <TabsTrigger value="emails">Email Notifications</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        {/* Recent Events Tab */}
        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>Recent Authentication Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {authLogs.slice(0, 50).map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      {getEventIcon(log.event_type, log.success)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{log.user_email}</span>
                          <Badge variant={getEventBadgeColor(log.event_type, log.success)}>
                            {log.event_type}
                          </Badge>
                          {log.success ? (
                            <Badge variant="outline" className="text-green-600">Success</Badge>
                          ) : (
                            <Badge variant="destructive">Failed</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatTimestamp(log.timestamp)}
                        </div>
                        {!log.success && log.error_details && (
                          <div className="text-xs text-red-600 mt-1">
                            {JSON.parse(log.error_details).message}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      {log.user_agent && (
                        <div className="max-w-xs truncate">
                          {log.user_agent}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {authLogs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No authentication events found.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Failed Attempts Tab */}
        <TabsContent value="failures">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                Failed Authentication Attempts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {authLogs.filter(log => !log.success).map((log) => (
                  <div key={log.id} className="p-4 border border-red-200 rounded-lg bg-red-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-red-900">{log.user_email}</span>
                          <Badge variant="destructive">{log.event_type}</Badge>
                        </div>
                        <div className="text-sm text-red-700 mt-1">
                          {formatTimestamp(log.timestamp)}
                        </div>
                        {log.error_details && (
                          <div className="text-sm text-red-800 mt-2 p-2 bg-white rounded border">
                            <strong>Error:</strong> {JSON.parse(log.error_details).message}
                          </div>
                        )}
                      </div>
                      
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        Details
                      </Button>
                    </div>
                  </div>
                ))}
                
                {authLogs.filter(log => !log.success).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-600" />
                    No failed authentication attempts found. Great job! 🎉
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Notifications Tab */}
        <TabsContent value="emails">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Email Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-4" />
                Email notification tracking coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle>Authentication Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {authStats.length > 0 ? (
                  <div>
                    <h3 className="font-medium mb-4">Event Breakdown by Type</h3>
                    <div className="space-y-2">
                      {authStats.map((stat, index) => (
                        <div key={index} className="flex justify-between items-center p-2 rounded bg-muted">
                          <span>{stat.event_type} ({stat.success ? 'Success' : 'Failed'})</span>
                          <Badge variant="outline">{stat.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No statistics available for the selected timeframe.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}