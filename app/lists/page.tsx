'use client';

import React from 'react';
import AppShell from '@/components/AppShell';
import EmployeesAndLists from '@/components/EmployeesAndLists';

export default function ListsPage() {
  return (
    <AppShell>
      {({
        demands,
        employees,
        schoolLists,
        handleCreateEmployee,
        handleUpdateEmployee,
        handleDeleteEmployee,
        handleCreateSchoolList,
        handleUpdateSchoolList,
        handleDeleteSchoolList,
        handleLinkSchoolListClient,
        handleConvertSchoolListToClient,
        loadData,
      }) => (
        <EmployeesAndLists
          demands={demands}
          employees={employees}
          schoolLists={schoolLists}
          onCreateEmployee={handleCreateEmployee}
          onUpdateEmployee={handleUpdateEmployee}
          onDeleteEmployee={handleDeleteEmployee}
          onCreateSchoolList={handleCreateSchoolList}
          onUpdateSchoolList={handleUpdateSchoolList}
          onDeleteSchoolList={handleDeleteSchoolList}
          onLinkSchoolListClient={handleLinkSchoolListClient}
          onConvertSchoolListToClient={handleConvertSchoolListToClient}
          onRefreshData={loadData}
        />
      )}
    </AppShell>
  );
}
