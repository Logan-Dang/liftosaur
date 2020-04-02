import { h, JSX } from "preact";
import { IProgram } from "../models/program";
import { IDispatch } from "../ducks/types";
import { HeaderView } from "./header";
import { FooterView } from "./footer";
import { IHistoryRecord } from "../models/history";
import { Program } from "../models/program";
import { Button } from "./button";
import { HistoryRecordView, NextProgramRecordView } from "./historyRecord";
import { IStats } from "../models/stats";

interface IProps {
  program: IProgram;
  stats: IStats;
  history: IHistoryRecord[];
  dispatch: IDispatch;
}

export function ProgramHistoryView(props: IProps): JSX.Element {
  const dispatch = props.dispatch;
  const lastHistoryRecord = props.history.find(i => i.programId === props.program.id);
  const nextHistoryRecord = Program.nextProgramRecord(props.program, props.stats, lastHistoryRecord?.day);

  const history = [...props.history].sort(
    (a, b) => new Date(Date.parse(a.date)).getTime() - new Date(Date.parse(b.date)).getTime()
  );

  return (
    <section className="flex flex-col h-full">
      <HeaderView title={props.program.name} subtitle="Current program" />
      <section className="flex-1">
        {history.map(historyRecord => (
          <HistoryRecordView historyRecord={historyRecord} dispatch={dispatch} />
        ))}
        <NextProgramRecordView historyRecord={nextHistoryRecord} dispatch={dispatch} />
        <div className="text-center py-3">
          <Button kind="green" onClick={() => props.dispatch({ type: "StartProgramDayAction" })}>
            Start Next Workout
          </Button>
        </div>
      </section>
      <FooterView />
    </section>
  );
}
