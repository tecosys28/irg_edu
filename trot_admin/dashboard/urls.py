from django.urls import path
from . import views

urlpatterns = [
    # Dashboard
    path('',                        views.index,            name='index'),

    # Users
    path('users/',                  views.users_list,       name='users_list'),
    path('users/<str:uid>/',        views.user_detail,      name='user_detail'),
    path('users/<str:uid>/delete/', views.user_delete,      name='user_delete'),

    # Issuances
    path('issuances/',                   views.issuances_list,   name='issuances_list'),
    path('issuances/<str:iid>/',         views.issuance_detail,  name='issuance_detail'),
    path('issuances/<str:iid>/delete/',  views.issuance_delete,  name='issuance_delete'),

    # Bulk + Import/Export
    path('bulk-action/',            views.bulk_action,      name='bulk_action'),
    path('export/',                 views.export_csv,       name='export_csv'),
    path('import/',                 views.import_csv,       name='import_csv'),
]
