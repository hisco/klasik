package main

import (
	chart "helm.sh/helm/v3/pkg/chart"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
)

// typeRegistry maps type paths to zero values of the types
// Types must be imported and registered at compile time
var typeRegistry = map[string]interface{}{
	// Helm chart types
	"helm.sh/helm/v3/pkg/chart.Metadata":   chart.Metadata{},
	"helm.sh/helm/v3/pkg/chart.Chart":      chart.Chart{},
	"helm.sh/helm/v3/pkg/chart.File":       chart.File{},
	"helm.sh/helm/v3/pkg/chart.Dependency": chart.Dependency{},
	"helm.sh/helm/v3/pkg/chart.Maintainer": chart.Maintainer{},

	// Kubernetes core types (v1)
	"k8s.io/api/core/v1.Pod":                corev1.Pod{},
	"k8s.io/api/core/v1.Service":            corev1.Service{},
	"k8s.io/api/core/v1.ConfigMap":          corev1.ConfigMap{},
	"k8s.io/api/core/v1.Secret":             corev1.Secret{},
	"k8s.io/api/core/v1.PersistentVolume":   corev1.PersistentVolume{},
	"k8s.io/api/core/v1.PersistentVolumeClaim": corev1.PersistentVolumeClaim{},

	// Kubernetes apps types (v1)
	"k8s.io/api/apps/v1.Deployment":  appsv1.Deployment{},
	"k8s.io/api/apps/v1.StatefulSet": appsv1.StatefulSet{},
	"k8s.io/api/apps/v1.DaemonSet":   appsv1.DaemonSet{},

	// Add more types here as needed
	// Example:
	// "github.com/myorg/package.MyStruct": mypackage.MyStruct{},
}
