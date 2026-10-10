'use client';

export const dynamic = 'force-dynamic';

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
        masterProducts,
        handleCreateEmployee,
        handleUpdateEmployee,
        handleDeleteEmployee,
        handleCreateSchoolList,
        handleUpdateSchoolList,
        handleDeleteSchoolList,
        handleLinkSchoolListClient,
        handleConvertSchoolListToClient,
        handleCreateDemand,
        loadData,
      }) => (
        <EmployeesAndLists
          demands={demands}
          employees={employees}
          schoolLists={schoolLists}
          masterProducts={masterProducts}
          onCreateEmployee={handleCreateEmployee}
          onUpdateEmployee={handleUpdateEmployee}
          onDeleteEmployee={handleDeleteEmployee}
          onCreateSchoolList={handleCreateSchoolList}
          onUpdateSchoolList={handleUpdateSchoolList}
          onDeleteSchoolList={handleDeleteSchoolList}
          onLinkSchoolListClient={handleLinkSchoolListClient}
          onConvertSchoolListToClient={handleConvertSchoolListToClient}
          onCreateDemand={handleCreateDemand}
          onRefreshData={loadData}
        />
      )}
    </AppShell>
  );
}
