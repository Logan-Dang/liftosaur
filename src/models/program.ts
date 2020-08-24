import { IHistoryRecord } from "./history";
import { Excercise, TExcerciseType } from "./excercise";
import * as t from "io-ts";
import { ISet, TProgramSet } from "./set";
import { ScriptRunner } from "../parser";
import { Progress } from "./progress";
import { ISettings } from "./settings";
import { Screen } from "./screen";
import { updateState, IState } from "../ducks/reducer";
import { lb, ILensRecordingPayload } from "../utils/lens";
import { IDispatch } from "../ducks/types";
import { IEither, IArrayElement } from "../utils/types";
import { TWeight, Weight } from "./weight";

export const TProgramDayEntry = t.type(
  {
    excercise: TExcerciseType,
    sets: t.array(TProgramSet),
  },
  "TProgramDayEntry"
);
export type IProgramDayEntry = t.TypeOf<typeof TProgramDayEntry>;

export const TProgramDay = t.type(
  {
    name: t.string,
    excercises: t.array(TProgramDayEntry),
  },
  "TProgramDay"
);
export type IProgramDay = t.TypeOf<typeof TProgramDay>;

export const TProgramInternalState = t.type(
  {
    nextDay: t.number,
  },
  "TProgramInternalState"
);
export type IProgramInternalState = t.TypeOf<typeof TProgramInternalState>;

export const TProgramState = t.dictionary(t.string, t.union([t.number, TWeight]), "TProgramState");
export type IProgramState = t.TypeOf<typeof TProgramState>;

const tags = ["first-starter", "beginner", "barbell", "dumbbell"] as const;

export const TProgramTag = t.keyof(
  tags.reduce<Record<IArrayElement<typeof tags>, null>>((memo, barKey) => {
    memo[barKey] = null;
    return memo;
  }, {} as Record<IArrayElement<typeof tags>, null>),
  "TProgramTag"
);
export type IProgramTag = t.TypeOf<typeof TProgramTag>;

export const TProgram = t.type(
  {
    id: t.string,
    name: t.string,
    description: t.string,
    url: t.string,
    author: t.string,
    days: t.array(TProgramDay),
    state: TProgramState,
    internalState: TProgramInternalState,
    finishDayExpr: t.string,
    tags: t.array(TProgramTag),
  },
  "TProgram"
);
export type IProgram = t.TypeOf<typeof TProgram>;

export namespace Program {
  export function getProgram(state: IState, id?: string): IProgram | undefined {
    return state.storage.programs.find((p) => p.id === id);
  }

  export function getEditingProgram(state: IState): IProgram | undefined {
    return state.storage.programs.find((p) => p.id === state.editProgram?.id);
  }

  export function getEditingProgramIndex(state: IState): number {
    return state.storage.programs.findIndex((p) => p.id === state.editProgram?.id);
  }

  export function getEditingDay(state: IState): IProgramDay | undefined {
    return state.storage.programs.find((p) => p.id === state.editProgram?.id)?.days?.[state.editProgram?.dayIndex || 0];
  }

  export function getProgramIndex(state: IState, id: string): number {
    return state.storage.programs.findIndex((p) => p.id === id);
  }

  export function createDay(name: string): IProgramDay {
    return {
      name,
      excercises: [],
    };
  }

  export function nextProgramRecord(program: IProgram, settings: ISettings, dayIndex?: number): IHistoryRecord {
    const day = Math.min(dayIndex || program.internalState.nextDay || 1, program.days.length);
    const programDay = program.days[day - 1];
    return {
      id: 0,
      date: new Date().toISOString(),
      programId: program.id,
      programName: program.name,
      day,
      dayName: programDay.name,
      startTime: Date.now(),
      entries: programDay.excercises.map((entry) => {
        const sets: ISet[] = entry.sets.map((set) => {
          const repsValue = new ScriptRunner(
            set.repsExpr,
            program.state,
            Progress.createEmptyScriptBindings(day),
            Progress.createScriptFunctions(settings),
            settings.units
          ).execute("reps");
          const weightValue = new ScriptRunner(
            set.weightExpr,
            program.state,
            Progress.createEmptyScriptBindings(day),
            Progress.createScriptFunctions(settings),
            settings.units
          ).execute("weight");
          return {
            isAmrap: set.isAmrap,
            reps: repsValue,
            weight: Weight.convertTo(weightValue, settings.units),
          };
        });
        return {
          excercise: entry.excercise,
          sets,
          warmupSets: sets[0]?.weight != null ? Excercise.getWarmupSets(entry.excercise, sets[0].weight, settings) : [],
        };
      }),
    };
  }

  export function getState(program: IProgram): Record<string, number> {
    return { ...program.internalState, ...program.state };
  }

  export function parseFinishDayScript(
    program: IProgram,
    dayIndex: number,
    settings: ISettings,
    script: string = program.finishDayExpr
  ): IEither<unknown, string> {
    const scriptRunner = new ScriptRunner(
      script,
      Program.getState(program),
      Progress.createEmptyScriptBindings(dayIndex),
      Progress.createScriptFunctions(settings),
      settings.units
    );

    try {
      return { success: true, data: scriptRunner.parse() };
    } catch (e) {
      if (e instanceof SyntaxError) {
        return { success: false, error: e.message };
      } else {
        throw e;
      }
    }
  }

  export function runFinishDayScript(
    program: IProgram,
    progress: IHistoryRecord,
    settings: ISettings,
    script: string = program.finishDayExpr
  ): IEither<IProgramState, string> {
    const bindings = Progress.createScriptBindings(progress);
    const fns = Progress.createScriptFunctions(settings);
    const newInternalState: IProgramInternalState = {
      nextDay: Program.nextDay(program, program.internalState.nextDay),
    };
    const newState: Record<string, number> = { ...newInternalState, ...program.state };

    try {
      new ScriptRunner(script, newState, bindings, fns, settings.units).execute();
    } catch (e) {
      if (e instanceof SyntaxError) {
        return { success: false, error: e.message };
      } else {
        throw e;
      }
    }

    return { success: true, data: newState };
  }

  export function cloneProgram(dispatch: IDispatch, program: IProgram): void {
    updateState(dispatch, [
      lb<IState>()
        .p("storage")
        .p("programs")
        .recordModify((programs) => {
          if (programs.some((p) => p.id === program.id)) {
            if (
              confirm(
                "You already have this program cloned. Do you want to override? All your modifications of this program will be lost."
              )
            ) {
              return programs.map((p) => (p.id === program.id ? program : p));
            } else {
              return programs;
            }
          } else {
            return [...programs, program];
          }
        }),
      ...selectProgram2LensRecordings(program.id),
    ]);
  }

  export function selectProgram(dispatch: IDispatch, programId: string): void {
    updateState(dispatch, selectProgram2LensRecordings(programId));
  }

  export function nextDay(program: IProgram, day?: number): number {
    return (day != null ? day % program.days.length : 0) + 1;
  }

  export function editAction(dispatch: IDispatch, id: string): void {
    updateState(dispatch, [
      lb<IState>().p("editProgram").record({ id }),
      lb<IState>()
        .p("screenStack")
        .recordModify((s) => Screen.push(s, "editProgram")),
    ]);
  }

  function selectProgram2LensRecordings(programId: string): ILensRecordingPayload<IState>[] {
    return [
      lb<IState>().p("storage").p("currentProgramId").record(programId),
      lb<IState>()
        .p("screenStack")
        .recordModify((s) => Screen.push(s, "main")),
    ];
  }
}
