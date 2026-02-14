import { Button } from '@/components/ui/button';
import { recordFeedback } from '@/lib/api/memoryFeedback';
import { toast } from 'sonner';

interface MemoryFeedbackProps {
    memoryId: string;
    sessionId: string;
}

export function MemoryFeedback({ memoryId, sessionId }: MemoryFeedbackProps) {
    const handleFeedback = async (action: 'approve' | 'reject') => {
        try {
            await recordFeedback(memoryId, action, sessionId);
            toast.success(action === 'approve' ? '已批准' : '已拒绝');
        } catch (error) {
            toast.error('反馈失败: ' + error);
        }
    };

    return (
        <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => handleFeedback('approve')}>
                ✓
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleFeedback('reject')}>
                ✗
            </Button>
        </div>
    );
}
