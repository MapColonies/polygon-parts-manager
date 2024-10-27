import {
  container as defaultContainer,
  type ClassProvider,
  type FactoryProvider,
  type InjectionToken,
  type ValueProvider,
  type Provider,
} from 'tsyringe';
import { type DependencyContainer, constructor } from 'tsyringe/dist/typings/types';

interface CreateAsyncProvider<T extends Provider | constructor<unknown>> {
  useAsync: (dependencyContainer: DependencyContainer) => Promise<T>;
}

async function getProvider<T>(injectionObj: InjectionObject<T>, container: DependencyContainer): Promise<Providers<T>> {
  if ('useAsync' in injectionObj.provider) {
    const provider = await injectionObj.provider.useAsync(container);
    return provider;
  } else {
    return injectionObj.provider;
  }
}

export type Providers<T> = ValueProvider<T> | FactoryProvider<T> | ClassProvider<T> | constructor<T>;

export interface InjectionObject<T> {
  token: InjectionToken<T>;
  provider: Providers<T> | CreateAsyncProvider<Providers<T>>;
}

export const registerDependencies = async (
  dependencies: InjectionObject<unknown>[],
  override?: InjectionObject<unknown>[],
  useChild = false
): Promise<DependencyContainer> => {
  const container = useChild ? defaultContainer.createChildContainer() : defaultContainer;

  for await (const injectionObj of dependencies) {
    const inject = override?.find((overrideObj) => overrideObj.token === injectionObj.token) ?? injectionObj;
    const provider = await getProvider(inject, container);
    container.register(injectionObj.token, provider as constructor<unknown>);
  }

  return container;
};
