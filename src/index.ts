import axios from "axios";
import config from "./config";

interface UserExperiment {
  id?: string;
  hash: number;
  revision: number;
  bucket: number;
  override: number;
  population: number;
  hash_result?: number;
}

interface UserExperimentRolloutList {
  fingerprint: string;
  assignments: number[][];
}

interface UserExperimentRolloutResponse {
  data: UserExperimentRolloutList;
}

interface RolloutRegistrar {
  id: string;
  defaultConfig: object;
  rollout: object;
  hash: number;
  creationDate: number;
  type: string;
  title: string;
  description: string[];
  buckets: number[];
}

interface RolloutRegistryResponse {
  data: RolloutRegistrar[];
}

(async () => {
  const response: RolloutRegistryResponse = await axios.get(
    config.EXPERIMENT_REGISTRY_URL
  );

  const rolloutRegistry: RolloutRegistrar[] = response.data;

  const userExperimentAverages: UserExperiment[][] = [];

  const rolloutRange: number = config.DEBUG ? config.DEBUG_EXPERIMENT_ROLLOUT_RANGE : config.EXPERIMENT_ROLLOUT_RANGE;

  for (let i = 0; i < rolloutRange; i++) {
    try {
      await new Promise((r) => setTimeout(r, 500));

      const response: UserExperimentRolloutResponse = await axios.get(
        config.EXPERIMENT_ROLLOUT_URL
      );

      const rolloutList: UserExperimentRolloutList = response.data;

      const userExperiments: UserExperiment[] = rolloutList.assignments.map(
        (assignment: number[]) => {
          return {
            id: rolloutRegistry.find((exp) => exp.hash === assignment[0])?.id,
            hash: assignment[0],
            revision: assignment[1],
            bucket: assignment[2],
            override: assignment[3],
            population: assignment[4],
            hash_result: assignment[5],
          } as UserExperiment;
        }
      );

      userExperimentAverages.push(userExperiments);

      if (config.DEBUG) {
        console.log(`[!] run ${i + 1}/${rolloutRange}`);
      }
    } catch (error) {
      console.log(`[!] oh no!\n${error}\n`);
    }
  }

  console.log();

  const uniqueExperimentIdentifiers: string[] = [
    ...new Set(
      userExperimentAverages
        .flat()
        .map((experiment: UserExperiment) => experiment.id as string)
        .filter((result: string) => result)
    ),
  ];

  for (const experimentIdentifier of uniqueExperimentIdentifiers) {
    const selectedAverages: UserExperiment[] = userExperimentAverages
      .flat()
      .filter(
        (experiment: UserExperiment) => experiment.id === experimentIdentifier
      );

    const experimentRollout: RolloutRegistrar = rolloutRegistry.find(
      (rollout: RolloutRegistrar) => rollout.id === experimentIdentifier
    ) as RolloutRegistrar;

    experimentRollout.buckets.forEach((bucket: number) => {
      const eligibilityAverage: UserExperiment[] = selectedAverages.filter(
        (experiment: UserExperiment) => experiment.bucket === bucket
      );

      const eligibilityPercentageRaw: number =
        (eligibilityAverage.length / rolloutRange) * 100;

      const eligibilityPercentage: number =
        Math.round(eligibilityPercentageRaw / 5) * 5;

      console.log(
        `[*] experiment ${experimentIdentifier} - rollout percentage for bucket ${bucket} (${experimentRollout.description[bucket]}): ${eligibilityPercentage}%`
      );
    });

    console.log();
  }
})();
