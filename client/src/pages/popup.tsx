import { useParams } from "wouter";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { JobPopup } from "@/components/job-popup-simple";
import type { JobWithMaterials } from "@shared/schema";

export default function PopupPage() {
  const { jobId } = useParams<{ jobId: string }>();
  
  // Fetch job data to set window title
  const { data: job } = useQuery<JobWithMaterials>({
    queryKey: [`/api/jobs/${jobId}`],
    enabled: !!jobId && !isNaN(Number(jobId))
  });

  // Set window title and add focus behaviors
  useEffect(() => {
    if (job) {
      document.title = `🏷️ ${job.customerName} - ${job.jobName} | Job Tracker`;
    } else {
      document.title = '🏷️ Job Tracker Popup';
    }
    
    // Add keyboard shortcut to refocus window (Ctrl+Space)
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        window.focus();
        // Flash the window to draw attention
        document.body.style.backgroundColor = '#3b82f6';
        setTimeout(() => {
          document.body.style.backgroundColor = '';
        }, 200);
      }
    };
    
    // Set up periodic focus attempts (every 3 seconds when window loses focus)
    let focusInterval: NodeJS.Timeout;
    
    const handleBlur = () => {
      focusInterval = setInterval(() => {
        if (!document.hasFocus()) {
          window.focus();
        } else {
          clearInterval(focusInterval);
        }
      }, 3000);
    };
    
    const handleFocus = () => {
      clearInterval(focusInterval);
    };
    
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    
    // Initial focus
    window.focus();
    
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      clearInterval(focusInterval);
    };
  }, [job]);
  
  if (!jobId || isNaN(Number(jobId))) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50">
        <div className="text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">Invalid Job ID</h1>
          <p className="text-red-500">Please provide a valid job ID in the URL.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <JobPopup
        jobId={Number(jobId)}
        onClose={() => window.close()}
      />
    </div>
  );
}