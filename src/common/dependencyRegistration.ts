import { ClassProvider, container as defaultContainer, FactoryProvider, InjectionToken, ValueProvider, type RegistrationOptions } from 'tsyringe';
import { constructor, DependencyContainer } from 'tsyringe/dist/typings/types';

export type Providers<T> = ValueProvider<T> | FactoryProvider<T> | ClassProvider<T> | constructor<T>;

export interface InjectionObject<T, ARGS extends unknown[] = unknown[]> {
  token: InjectionToken<T>;
  provider: Providers<T>;
  dependencyRegistration?: (...any: ARGS) => Promise<unknown>;
}

export const registerDependencies = async (
  dependencies: InjectionObject<unknown>[],
  override?: InjectionObject<unknown>[],
  useChild = false
): Promise<DependencyContainer> => {
  const container = useChild ? defaultContainer.createChildContainer() : defaultContainer;
  for await (const injectionObj of dependencies) {
    const inject = override?.find((overrideObj) => overrideObj.token === injectionObj.token) === undefined;
    if (injectionObj.dependencyRegistration) {
      await injectionObj.dependencyRegistration();
    }
    if (inject) {
      container.register(injectionObj.token, injectionObj.provider as constructor<unknown>);
    }
  }
  override?.forEach((injectionObj) => {
    container.register(injectionObj.token, injectionObj.provider as constructor<unknown>);
  });
  return container;
};
