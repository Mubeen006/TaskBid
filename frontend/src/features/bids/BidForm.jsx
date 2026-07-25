import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateBid } from "./useCreateBid";
import { useWorkload } from "../tasks/useWorkload";

const formStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  padding: "14px 16px",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--code-bg)",
};

const inputRowStyle = {
  display: "flex",
  gap: "8px",
  alignItems: "flex-start",
};

const inputStyle = {
  padding: "6px 10px",
  borderRadius: "6px",
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text-h)",
  fontSize: "0.9rem",
  width: "90px",
};

const btnStyle = (disabled) => ({
  padding: "6px 16px",
  borderRadius: "6px",
  border: "none",
  background: disabled ? "var(--border)" : "var(--accent)",
  color: disabled ? "var(--text)" : "#fff",
  fontWeight: "600",
  fontSize: "0.88rem",
  cursor: disabled ? "not-allowed" : "pointer",
});

const capacityStyle = (low) => ({
  fontSize: "0.82rem",
  color: low ? "#dc2626" : "var(--text)",
  fontWeight: low ? "600" : "400",
});

const errorStyle = {
  fontSize: "0.82rem",
  color: "#dc2626",
  padding: "6px 10px",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: "6px",
};

const successStyle = {
  fontSize: "0.82rem",
  color: "#166534",
  padding: "6px 10px",
  background: "#dcfce7",
  border: "1px solid #bbf7d0",
  borderRadius: "6px",
};

const disabledBoxStyle = {
  padding: "10px 14px",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  background: "var(--code-bg)",
  fontSize: "0.85rem",
  color: "var(--text)",
  fontStyle: "italic",
};

export default function BidForm({ task, currentUser, bids }) {
  const queryClient = useQueryClient();
  const createBid = useCreateBid(task._id);
  const { data: workload, refetch: refetchWorkload } = useWorkload(currentUser?._id);

  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({ defaultValues: { hoursOffered: "" } });

  const hoursValue = parseFloat(watch("hoursOffered"));
  const remaining = workload?.remainingCapacityHours ?? null;
  const exceedsCapacity = remaining !== null && hoursValue > 0 && hoursValue > remaining;

  useEffect(() => {
    setSubmitError(null);
    setSubmitSuccess(false);
  }, [currentUser?._id]);

  if (!currentUser) {
    return <p style={disabledBoxStyle}>Select a user to place a bid.</p>;
  }

  const isSelfBid = String(task.createdBy) === String(currentUser._id);
  if (isSelfBid) {
    return <p style={disabledBoxStyle}>You created this task — you cannot bid on it.</p>;
  }

  if (task.status !== "open") {
    return <p style={disabledBoxStyle}>Bidding is closed for this task (status: {task.status}).</p>;
  }

  const alreadyBid = bids?.some((b) => String(b.user) === String(currentUser._id));
  if (alreadyBid) {
    return <p style={disabledBoxStyle}>You have already placed a bid on this task.</p>;
  }

  async function onSubmit(data) {
    const hours = parseFloat(data.hoursOffered);
    setSubmitError(null);
    setSubmitSuccess(false);

    if (remaining !== null && hours > remaining) {
      setSubmitError(`This exceeds your remaining capacity (${remaining}h).`);
      return;
    }

    try {
      await createBid.mutateAsync({ hoursOffered: hours, userId: currentUser._id });
      reset();
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      if (err.code === "UNPROCESSABLE") {
        await refetchWorkload();
        const fresh = queryClient.getQueryData(["workload", currentUser._id]);
        const freshRemaining = fresh?.remainingCapacityHours ?? "unknown";
        setSubmitError(
          `Your available capacity has changed since this page loaded — you now have ${freshRemaining}h remaining.`
        );
      } else {
        setSubmitError(err.message || "Failed to place bid.");
      }
    }
  }

  return (
    <form style={formStyle} onSubmit={handleSubmit(onSubmit)} noValidate>
      <div style={capacityStyle(remaining !== null && remaining < 1)}>
        {remaining !== null
          ? `Your remaining capacity: ${remaining}h`
          : "Loading capacity…"}
      </div>

      <div style={inputRowStyle}>
        <div>
          <input
            id="hoursOffered"
            type="number"
            min="0.01"
            step="0.5"
            placeholder="Hours"
            style={{
              ...inputStyle,
              ...(errors.hoursOffered || exceedsCapacity ? { borderColor: "#dc2626" } : {}),
            }}
            aria-label="Hours offered"
            {...register("hoursOffered", {
              required: "Required",
              min: { value: 0.01, message: "Must be > 0" },
              validate: (v) => {
                const n = parseFloat(v);
                if (isNaN(n) || n <= 0) return "Must be a positive number";
                return true;
              },
            })}
          />
          {errors.hoursOffered && (
            <p style={{ ...errorStyle, marginTop: "4px", padding: "2px 6px" }}>
              {errors.hoursOffered.message}
            </p>
          )}
          {exceedsCapacity && !errors.hoursOffered && (
            <p style={{ ...errorStyle, marginTop: "4px", padding: "2px 6px" }}>
              Exceeds your {remaining}h remaining capacity.
            </p>
          )}
        </div>
        <button
          type="submit"
          style={btnStyle(createBid.isPending || exceedsCapacity)}
          disabled={createBid.isPending || exceedsCapacity}
        >
          {createBid.isPending ? "Placing…" : "Place Bid"}
        </button>
      </div>

      {submitError && <p style={errorStyle} role="alert">{submitError}</p>}
      {submitSuccess && <p style={successStyle} role="status">Bid placed successfully.</p>}
    </form>
  );
}
