import { SyncOutlined } from "@ant-design/icons";
import {
    Button,
    Popover,
    Typography,
} from "antd";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { api } from "../../api";
import { isElectronRuntime as detectElectronRuntime } from "../../platform/runtime";
import type { RootState } from "../../store";
import { getInstituteName } from "../../store/user";

type JobInfo = {
    jobUuid: string;
    status: string;
    progressPercent: number;
};

const QueuePopover = () => {
    const isElectron = detectElectronRuntime();
    const instituteName = useSelector((state: RootState) =>
        getInstituteName(state),
    );

    const [queueJobs, setQueueJobs] = useState<JobInfo[]>([]);
    const [open, setOpen] = useState(false);
    const [cancellingJobUuid, setCancellingJobUuid] = useState<string | null>(null);

    useEffect(() => {
        if (!isElectron || !instituteName) return;
        const poll = async () => {
            try {
                const active = await api.activeEvaluationJobs({ instituteName });
                setQueueJobs(active?.jobs ?? []);
            } catch {
                // ignore
            }
        };
        poll();
        const interval = setInterval(poll, 3000);
        return () => clearInterval(interval);
    }, [isElectron, instituteName]);

    const handleCancelJob = async (jobUuid: string) => {
        setCancellingJobUuid(jobUuid);
        try {
            await api.cancelEvaluationJob({ jobUuid });
        } catch {
            // ignore
        } finally {
            setCancellingJobUuid(null);
        }
    };

    if (!isElectron) return null;

    const hasEvaluating = queueJobs.some((j) => j.status === "evaluating");

    const label = (job: JobInfo) =>
        job.status === "evaluating"
            ? `评估中 ${job.progressPercent}%`
            : "等待中";

    return (
        <Popover
            trigger="click"
            open={open}
            onOpenChange={setOpen}
            title={`评估队列 · ${queueJobs.length}`}
            content={
                <div style={{ minWidth: 220 }}>
                    {queueJobs.length === 0 ? (
                        <Typography.Text type="secondary">暂无评估任务</Typography.Text>
                    ) : (
                        queueJobs.map((job, idx) => (
                            <div
                                key={job.jobUuid}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "4px 0",
                                }}
                            >
                                <Typography.Text
                                    type="secondary"
                                    style={{ fontSize: 13 }}
                                >
                                    {idx + 1}. {label(job)}
                                </Typography.Text>
                                {job.status === "evaluating" && (
                                    <Button
                                        size="small"
                                        type="link"
                                        danger
                                        loading={cancellingJobUuid === job.jobUuid}
                                        onClick={() => handleCancelJob(job.jobUuid)}
                                        style={{ padding: 0, height: "auto", fontSize: 12 }}
                                    >
                                        中止
                                    </Button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            }
        >
            <Button
                type="text"
                icon={<SyncOutlined spin={hasEvaluating} />}
                style={hasEvaluating ? { color: "#ff4d4f" } : undefined}
            />
        </Popover>
    );
};

export default QueuePopover;

