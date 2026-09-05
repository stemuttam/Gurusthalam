import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  DefaultCourseApplicationService,
} from '@gurusthalam/courses';

import {
  AppModule,
} from '../app/app.module.js';

import {
  CoursesApplicationModule,
} from './courses-application.module.js';


const IMPORTS_METADATA_KEY =
  'imports';

const EXPORTS_METADATA_KEY =
  'exports';


const getModuleMetadata =
  (
    moduleClass:
      new (...args: never[]) => unknown,
    metadataKey: string,
  ): unknown[] => {
    const metadata =
      Reflect.getMetadata(
        metadataKey,
        moduleClass,
      ) as unknown[] | undefined;

    if (metadata === undefined) {
      throw new Error(
        `Expected ${metadataKey} metadata to be defined for ${moduleClass.name}.`,
      );
    }

    return metadata;
  };


describe(
  'Course API module composition',
  () => {
    it(
      'registers CoursesApplicationModule in AppModule imports',
      () => {
        const imports =
          getModuleMetadata(
            AppModule,
            IMPORTS_METADATA_KEY,
          );

        expect(
          imports,
        ).toContain(
          CoursesApplicationModule,
        );
      },
    );


    it(
      'does not register CoursesPersistenceModule directly in AppModule',
      () => {
        const imports =
          getModuleMetadata(
            AppModule,
            IMPORTS_METADATA_KEY,
          );

        const importedModuleNames =
          imports
            .filter(
              (
                importedModule,
              ): importedModule is
                new (...args: never[]) => unknown =>
                typeof importedModule ===
                'function',
            )
            .map(
              (
                importedModule,
              ) =>
                importedModule.name,
            );

        expect(
          importedModuleNames,
        ).not.toContain(
          'CoursesPersistenceModule',
        );
      },
    );


    it(
      'keeps CoursesPersistenceModule behind CoursesApplicationModule',
      () => {
        const imports =
          getModuleMetadata(
            CoursesApplicationModule,
            IMPORTS_METADATA_KEY,
          );

        const importedModuleNames =
          imports
            .filter(
              (
                importedModule,
              ): importedModule is
                new (...args: never[]) => unknown =>
                typeof importedModule ===
                'function',
            )
            .map(
              (
                importedModule,
              ) =>
                importedModule.name,
            );

        expect(
          importedModuleNames,
        ).toContain(
          'CoursesPersistenceModule',
        );
      },
    );


    it(
      'exports DefaultCourseApplicationService from CoursesApplicationModule',
      () => {
        const exportsMetadata =
          getModuleMetadata(
            CoursesApplicationModule,
            EXPORTS_METADATA_KEY,
          );

        expect(
          exportsMetadata,
        ).toContain(
          DefaultCourseApplicationService,
        );
      },
    );
  },
);