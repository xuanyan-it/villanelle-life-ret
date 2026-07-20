import { useSelector } from "react-redux";
import { selectBatchProgressState } from "../store/record";
export const useBatchProgress = () => {
  return useSelector(selectBatchProgressState);
};
